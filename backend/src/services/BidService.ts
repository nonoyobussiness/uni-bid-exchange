import crypto from "crypto";

import mongoose, { Types } from "mongoose";

import { AuctionModel } from "../models/Auction";
import { BidModel } from "../models/Bid";
import { TransactionModel } from "../models/Transaction";
import { WalletModel } from "../models/Wallet";
import { AppError } from "../utils/errors";
import { acquireLock, checkBidRateLimit, releaseLock } from "../utils/redis";

type PlaceBidInput = {
  auctionId: string;
  bidderId: string;
  amount: number;
};

export type PlaceBidResult = {
  auction: Record<string, unknown>;
  previousHighestBidderId: string | null;
  bidderId: string;
  amount: number;
  auctionId: string;
};

type BidTransactionRecord = {
  userId: Types.ObjectId;
  type: "hold" | "release";
  amount: number;
  description: string;
  status: "completed";
};

const validateAuctionForBid = (auction: {
  status: string;
  endsAt: Date;
  currentBid: number;
  sellerId: Types.ObjectId;
}, amount: number, bidderId: string): void => {
  if (auction.status !== "active" || auction.endsAt.getTime() <= Date.now()) {
    throw new AppError(400, "Auction is not open for bidding");
  }

  if (auction.sellerId.toString() === bidderId) {
    throw new AppError(400, "You cannot bid on your own auction");
  }

  if (amount <= auction.currentBid) {
    throw new AppError(400, "Bid amount must be higher than the current bid");
  }
};

const createBidTransactionRecord = (
  userId: string,
  type: "hold" | "release",
  amount: number,
  auctionId: Types.ObjectId,
): BidTransactionRecord => ({
  userId: new Types.ObjectId(userId),
  type,
  amount,
  description:
    type === "hold"
      ? `Funds held for bid on auction ${auctionId.toString()}`
      : `Held funds released for auction ${auctionId.toString()}`,
  status: "completed",
});

export class BidService {
  static async placeBid(input: PlaceBidInput): Promise<PlaceBidResult> {
    if (!Types.ObjectId.isValid(input.auctionId)) {
      throw new AppError(400, "Invalid auction id");
    }

    const auctionObjectId = new Types.ObjectId(input.auctionId);

    const initialAuction = await AuctionModel.findById(auctionObjectId).lean();
    if (!initialAuction) {
      throw new AppError(404, "Auction not found before bid processing");
    }

    validateAuctionForBid(initialAuction, input.amount, input.bidderId);

    const withinLimit = await checkBidRateLimit(input.bidderId, input.auctionId);
    if (!withinLimit) {
      console.log(
        `[Bid:REJECT] Rate limit exceeded: user=${input.bidderId}, auction=${input.auctionId}`,
      );
      throw new AppError(429, "Too many bids. Please wait a few seconds before trying again.");
    }

    const lockKey = `auction:lock:${input.auctionId}`;
    const lockValue = crypto.randomUUID();
    const lockAcquired = await acquireLock(lockKey, lockValue, 5);

    if (!lockAcquired) {
      console.log(
        `[Bid:REJECT] Lock contention: user=${input.bidderId}, auction=${input.auctionId}`,
      );
      throw new AppError(409, "Another bid is currently being processed. Please retry.");
    }

    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const auction = await AuctionModel.findById(auctionObjectId).session(session);
      if (!auction) {
        throw new AppError(404, "Auction disappeared during bid processing");
      }

      validateAuctionForBid(auction, input.amount, input.bidderId);

      const currentLeadingBid = await BidModel.findOne({
        auctionId: auction._id,
        amount: auction.currentBid,
      })
        .sort({ createdAt: -1 })
        .session(session);

      const previousHighestBidderId = currentLeadingBid?.userId.toString() ?? null;
      const previousHighestAmount = currentLeadingBid ? auction.currentBid : 0;
      let releasedAmount = 0;

      const bidderWallet = await WalletModel.findOne({ userId: input.bidderId }).session(session);
      if (!bidderWallet) {
        throw new AppError(404, "Bidder wallet not found");
      }

      const availableBalance =
        bidderWallet.balance +
        (previousHighestBidderId === input.bidderId ? previousHighestAmount : 0);

      if (availableBalance < input.amount) {
        throw new AppError(400, "Insufficient available balance");
      }

      let previousBidderWallet = null;
      if (previousHighestBidderId && previousHighestBidderId !== input.bidderId) {
        previousBidderWallet = await WalletModel.findOne({ userId: previousHighestBidderId }).session(
          session,
        );

        if (!previousBidderWallet) {
          throw new AppError(404, "Previous highest bidder wallet not found");
        }
      }

      bidderWallet.balance -= input.amount;
      bidderWallet.held += input.amount;

      if (previousHighestBidderId === input.bidderId) {
        if (previousHighestAmount <= 0 || bidderWallet.held < previousHighestAmount) {
          throw new AppError(409, "Existing held funds are inconsistent");
        }

        bidderWallet.balance += previousHighestAmount;
        bidderWallet.held -= previousHighestAmount;
        releasedAmount = previousHighestAmount;
      } else if (previousBidderWallet) {
        if (previousHighestAmount <= 0 || previousBidderWallet.held < previousHighestAmount) {
          throw new AppError(409, "Previous bidder held funds are inconsistent");
        }

        previousBidderWallet.balance += previousHighestAmount;
        previousBidderWallet.held -= previousHighestAmount;
        releasedAmount = previousHighestAmount;
        await previousBidderWallet.save({ session });
      }

      if (bidderWallet.balance < 0 || bidderWallet.held < 0) {
        throw new AppError(409, "Wallet balance would become invalid");
      }

      await bidderWallet.save({ session });

      await BidModel.insertMany(
        [
          {
            auctionId: auction._id,
            userId: new Types.ObjectId(input.bidderId),
            amount: input.amount,
          },
        ],
        { session },
      );

      auction.currentBid = input.amount;
      auction.bidCount += 1;
      await auction.save({ session });

      const transactionRecords: BidTransactionRecord[] = [
        createBidTransactionRecord(input.bidderId, "hold", input.amount, auction._id),
      ];

      if (previousHighestBidderId && releasedAmount > 0) {
        transactionRecords.push(
          createBidTransactionRecord(
            previousHighestBidderId,
            "release",
            releasedAmount,
            auction._id,
          ),
        );
      }

      await TransactionModel.insertMany(transactionRecords, { session });

      await session.commitTransaction();

      const updatedAuction = await AuctionModel.findById(auction._id)
        .populate("sellerId", "fullName university trustScore avatarUrl bio createdAt")
        .lean();

      return {
        auction: updatedAuction as Record<string, unknown>,
        previousHighestBidderId:
          previousHighestBidderId !== input.bidderId ? previousHighestBidderId : null,
        bidderId: input.bidderId,
        amount: input.amount,
        auctionId: input.auctionId,
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
      await releaseLock(lockKey, lockValue);
    }
  }
}
