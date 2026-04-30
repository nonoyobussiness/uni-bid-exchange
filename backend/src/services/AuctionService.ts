import mongoose, { FilterQuery, Types } from "mongoose";

import { AuctionDocument, AuctionModel } from "../models/Auction";
import { BidModel } from "../models/Bid";
import { TransactionModel } from "../models/Transaction";
import { WalletModel } from "../models/Wallet";
import { uploadImages } from "../utils/cloudinary";
import { AppError } from "../utils/errors";
import { getIO } from "../sockets";

type SortOption = "endingSoon" | "priceLowToHigh" | "priceHighToLow";
type StatusOption = "active" | "processing" | "sold" | "expired" | "cancelled";

export type ListAuctionsInput = {
  category?: string;
  q?: string;
  status?: StatusOption;
  sort?: SortOption;
  page: number;
  limit: number;
};

export type CreateAuctionInput = {
  title: string;
  description: string;
  category: string;
  startingPrice: number;
  endsAt: Date;
  images: string[];
  sellerId: string;
};

export type UpdateAuctionInput = {
  title?: string;
  description?: string;
  category?: string;
  endsAt?: Date;
  sellerId: string;
};

const getSort = (sort?: SortOption): Record<string, 1 | -1> => {
  switch (sort) {
    case "priceLowToHigh":
      return { currentBid: 1, endsAt: 1 };
    case "priceHighToLow":
      return { currentBid: -1, endsAt: 1 };
    case "endingSoon":
    default:
      return { endsAt: 1, createdAt: -1 };
  }
};

const ensureFutureDate = (endsAt: Date): void => {
  if (endsAt.getTime() <= Date.now()) {
    throw new AppError(400, "Auction end time must be in the future");
  }
};

export class AuctionService {
  static async listAuctions(input: ListAuctionsInput) {
    const filter: FilterQuery<AuctionDocument> = {};

    // Default behavior: return all auctions (any status, any end time).
    // If the caller explicitly asks for active, apply the "not ended yet" constraint.
    if (input.status) {
      filter.status = input.status;
      if (input.status === "active") {
        filter.endsAt = { $gt: new Date() };
      }
    }

    if (input.category) {
      filter.category = input.category;
    }

    if (input.q) {
      const regex = new RegExp(input.q, "i");
      filter.$or = [{ title: regex }, { description: regex }];
    }

    const skip = (input.page - 1) * input.limit;
    const [items, total] = await Promise.all([
      AuctionModel.find(filter)
        .sort(getSort(input.sort))
        .skip(skip)
        .limit(input.limit)
        .lean(),
      AuctionModel.countDocuments(filter),
    ]);

    return {
      items,
      pagination: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / input.limit)),
      },
    };
  }

  static async getAuctionById(auctionId: string) {
    if (!Types.ObjectId.isValid(auctionId)) {
      throw new AppError(400, "Invalid auction id");
    }

    const auction = await AuctionModel.findById(auctionId)
      .populate("sellerId", "fullName university trustScore avatarUrl bio createdAt")
      .lean();

    if (!auction) {
      throw new AppError(404, "Auction not found");
    }

    const bidHistory = await BidModel.find({ auctionId })
      .populate("userId", "fullName avatarUrl university")
      .sort({ amount: -1, createdAt: -1 })
      .lean();

    return {
      ...auction,
      bidHistory,
    };
  }

  static async createAuction(input: CreateAuctionInput) {
    ensureFutureDate(input.endsAt);

    const sellerId = new Types.ObjectId(input.sellerId);
    console.log(`[AuctionService.createAuction] Input images (${input.images.length}):`, 
      input.images.map((img, i) => `[${i}] ${img.substring(0, 100)}...`));
    
    const imageUrls = await uploadImages(input.images);
    console.log(`[AuctionService.createAuction] Processed images (${imageUrls.length}):`, 
      imageUrls.map((url, i) => `[${i}] ${url.substring(0, 100)}...`));

    const auction = await AuctionModel.create({
      title: input.title,
      description: input.description,
      category: input.category,
      images: imageUrls,
      startingPrice: input.startingPrice,
      currentBid: input.startingPrice,
      bidCount: 0,
      sellerId,
      status: "active",
      endsAt: input.endsAt,
    });

    console.log(`[AuctionService.createAuction] Created auction ${auction._id} with images:`,
      auction.images.map((url, i) => `[${i}] ${url.substring(0, 100)}...`));

    return auction.toObject();
  }

  static async updateAuction(auctionId: string, input: UpdateAuctionInput) {
    if (!Types.ObjectId.isValid(auctionId)) {
      throw new AppError(400, "Invalid auction id");
    }

    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const auction = await AuctionModel.findById(auctionId).session(session);
      if (!auction) {
        throw new AppError(404, "Auction not found");
      }

      if (auction.sellerId.toString() !== input.sellerId) {
        throw new AppError(403, "You can only edit your own auctions");
      }

      const bidCount = await BidModel.countDocuments({ auctionId: auction._id }).session(session);
      if (bidCount > 0) {
        throw new AppError(409, "Auction cannot be edited after receiving bids");
      }

      if (input.endsAt) {
        ensureFutureDate(input.endsAt);
        auction.endsAt = input.endsAt;
      }

      if (input.title !== undefined) {
        auction.title = input.title;
      }

      if (input.description !== undefined) {
        auction.description = input.description;
      }

      if (input.category !== undefined) {
        auction.category = input.category;
      }

      await auction.save({ session });
      await session.commitTransaction();

      return auction.toObject();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  static async deleteAuction(auctionId: string, sellerId: string) {
    if (!Types.ObjectId.isValid(auctionId)) {
      throw new AppError(400, "Invalid auction id");
    }

    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const auction = await AuctionModel.findById(auctionId).session(session);
      if (!auction) {
        throw new AppError(404, "Auction not found");
      }

      if (auction.sellerId.toString() !== sellerId) {
        throw new AppError(403, "You can only delete your own auctions");
      }

      const bidCount = await BidModel.countDocuments({ auctionId: auction._id }).session(session);
      if (bidCount > 0) {
        throw new AppError(409, "Cannot delete auction with existing bids. Use cancel instead.");
      }

      // Store auction data before deletion for response
      const auctionData = auction.toObject();

      await AuctionModel.deleteOne({ _id: auctionId }).session(session);
      await session.commitTransaction();

      return {
        success: true,
        message: "Auction deleted successfully",
        deletedAuction: auctionData,
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  static async cancelAuction(auctionId: string, sellerId: string) {
    if (!Types.ObjectId.isValid(auctionId)) {
      throw new AppError(400, "Invalid auction id");
    }

    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const auction = await AuctionModel.findById(auctionId).session(session);
      if (!auction) {
        throw new AppError(404, "Auction not found");
      }

      if (auction.sellerId.toString() !== sellerId) {
        throw new AppError(403, "You can only cancel your own auctions");
      }

      if (auction.status !== "active") {
        throw new AppError(409, "Can only cancel active auctions");
      }

      // Mark auction as cancelled
      auction.status = "cancelled";
      await auction.save({ session });

      // Fetch all bids for this auction
      const bids = await BidModel.find({ auctionId: auction._id }).session(session);

      if (bids.length > 0) {
        console.log(
          `[AuctionService.cancelAuction] Refunding ${bids.length} bidders for auction ${auctionId}`,
        );

        // Get unique bidders and calculate total refund amount
        const bidderIds = new Set(bids.map((b) => b.userId.toString()));
        const bidsByBidder = new Map<string, number>();

        // Group bids by bidder (taking the latest/highest bid)
        for (const bid of bids.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())) {
          const bidderIdStr = bid.userId.toString();
          if (!bidderIds.has(bidderIdStr)) continue;
          if (!bidsByBidder.has(bidderIdStr)) {
            bidsByBidder.set(bidderIdStr, bid.amount);
          }
        }

        // Refund each bidder
        const transactionsToCreate = [];
        for (const [bidderIdStr, amount] of bidsByBidder.entries()) {
          const bidderId = new Types.ObjectId(bidderIdStr);

          // Update wallet: release held funds, add back to balance
          const wallet = await WalletModel.findOne({ userId: bidderId }).session(session);
          if (wallet) {
            wallet.held = Math.max(0, wallet.held - amount);
            wallet.balance += amount;
            await wallet.save({ session });
            console.log(
              `[AuctionService.cancelAuction] Refunded ${amount} to bidder ${bidderIdStr}`,
            );
          }

          // Create transaction record
          transactionsToCreate.push({
            userId: bidderId,
            type: "release",
            amount,
            description: `Refund for cancelled auction ${auctionId}`,
            status: "completed",
          });
        }

        // Bulk create transaction records
        if (transactionsToCreate.length > 0) {
          await TransactionModel.insertMany(transactionsToCreate, { session });
        }
      }

      await session.commitTransaction();

      // Emit socket event to auction room
      try {
        const io = getIO();
        io.to(`auction:${auctionId}`).emit("auction:cancelled", {
          auctionId,
          status: "cancelled",
          message: "Auction has been cancelled and all bids have been refunded",
        });
        console.log(`[AuctionService.cancelAuction] Emitted socket event for auction ${auctionId}`);
      } catch (socketError) {
        // Socket event emission failure shouldn't rollback the transaction
        console.error(
          `[AuctionService.cancelAuction] Failed to emit socket event: ${socketError}`,
        );
      }

      return auction.toObject();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
}
