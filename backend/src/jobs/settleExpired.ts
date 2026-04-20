import crypto from "crypto";

import cron from "node-cron";
import mongoose, { Types } from "mongoose";

import { AuctionModel } from "../models/Auction";
import { BidModel } from "../models/Bid";
import { TransactionModel } from "../models/Transaction";
import { WalletModel } from "../models/Wallet";
import { getIO } from "../sockets";
import { acquireLock, releaseLock } from "../utils/redis";

// ============================================================
// Settle a single auction that is already in "processing" state
// ============================================================

async function settleAuction(auctionId: Types.ObjectId): Promise<void> {
  // Idempotency re-check: confirm auction is still in "processing"
  const processingAuction = await AuctionModel.findOne({
    _id: auctionId,
    status: "processing",
  }).lean();

  if (!processingAuction) {
    console.log(`[Settlement:SKIP] Auction ${auctionId.toString()} no longer in processing state`);
    return;
  }

  const highestBid = await BidModel.findOne({ auctionId })
    .sort({ amount: -1, createdAt: 1 })
    .lean();

  // ---- No bids: mark as expired ----
  if (!highestBid) {
    await AuctionModel.updateOne(
      { _id: auctionId, status: "processing" },
      { $set: { status: "expired" } },
    );

    try {
      const io = getIO();
      io.to(`auction:${auctionId.toString()}`).emit("auction:ended", {
        auctionId: auctionId.toString(),
        winner: null,
        finalPrice: null,
      });
    } catch {
      /* Socket may not be available in tests */
    }

    console.log(`[Settlement] Auction expired (no bids): ${auctionId.toString()}`);
    return;
  }

  // ---- Has bids: settle the auction ----
  const winnerId = highestBid.userId;
  const finalPrice = highestBid.amount;
  const sellerId = processingAuction.sellerId;

  // Wallet integrity pre-check (before starting a transaction)
  const winnerWalletCheck = await WalletModel.findOne({ userId: winnerId }).lean();
  if (!winnerWalletCheck) {
    console.error(
      `[Settlement:INTEGRITY] Winner wallet not found: ` +
        `winner=${winnerId.toString()}, auction=${auctionId.toString()}`,
    );
    await AuctionModel.updateOne(
      { _id: auctionId, status: "processing" },
      { $set: { status: "expired" } },
    );
    return;
  }

  if (winnerWalletCheck.held < finalPrice) {
    console.error(
      `[Settlement:INTEGRITY] Insufficient held funds: ` +
        `winner=${winnerId.toString()}, held=${winnerWalletCheck.held}, ` +
        `needed=${finalPrice}, auction=${auctionId.toString()}`,
    );
    await AuctionModel.updateOne(
      { _id: auctionId, status: "processing" },
      { $set: { status: "expired" } },
    );
    return;
  }

  const sellerWalletCheck = await WalletModel.findOne({ userId: sellerId }).lean();
  if (!sellerWalletCheck) {
    console.error(
      `[Settlement:INTEGRITY] Seller wallet not found: ` +
        `seller=${sellerId.toString()}, auction=${auctionId.toString()}`,
    );
    await AuctionModel.updateOne(
      { _id: auctionId, status: "processing" },
      { $set: { status: "expired" } },
    );
    return;
  }

  // ---- Transactional settlement ----
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const winnerWallet = await WalletModel.findOne({ userId: winnerId }).session(session);
    if (!winnerWallet) {
      throw new Error(`Winner wallet not found: ${winnerId.toString()}`);
    }

    const sellerWallet = await WalletModel.findOne({ userId: sellerId }).session(session);
    if (!sellerWallet) {
      throw new Error(`Seller wallet not found: ${sellerId.toString()}`);
    }

    // Double-check inside transaction (wallet state could have changed)
    if (winnerWallet.held < finalPrice) {
      throw new Error(
        `Winner held funds inconsistent: held=${winnerWallet.held}, needed=${finalPrice}`,
      );
    }

    // Deduct from winner held → totalSpent
    winnerWallet.held -= finalPrice;
    winnerWallet.totalSpent += finalPrice;

    // Negative balance guard
    if (winnerWallet.balance < 0 || winnerWallet.held < 0) {
      throw new Error(
        `Wallet would become negative: balance=${winnerWallet.balance}, held=${winnerWallet.held}`,
      );
    }

    await winnerWallet.save({ session });

    // Credit seller balance
    sellerWallet.balance += finalPrice;
    sellerWallet.totalDeposited += finalPrice;
    await sellerWallet.save({ session });

    // Create transaction records
    await TransactionModel.insertMany(
      [
        {
          userId: winnerId,
          type: "purchase",
          amount: finalPrice,
          description: `Auction won: ${processingAuction.title} (${auctionId.toString()})`,
          status: "completed",
        },
        {
          userId: sellerId,
          type: "sale",
          amount: finalPrice,
          description: `Auction sold: ${processingAuction.title} (${auctionId.toString()})`,
          status: "completed",
        },
      ],
      { session },
    );

    // Finalize auction status (atomic — only if still "processing")
    const updateResult = await AuctionModel.updateOne(
      { _id: auctionId, status: "processing" },
      { $set: { status: "sold", winnerId } },
      { session },
    );

    if (updateResult.modifiedCount !== 1) {
      throw new Error(`Failed to finalize auction status: ${auctionId.toString()}`);
    }

    await session.commitTransaction();

    // Emit real-time settlement events
    try {
      const io = getIO();

      io.to(`auction:${auctionId.toString()}`).emit("auction:ended", {
        auctionId: auctionId.toString(),
        winner: winnerId.toString(),
        finalPrice,
      });

      io.to(`user:${winnerId.toString()}`).emit("auction:won", {
        auctionId: auctionId.toString(),
        amount: finalPrice,
      });
    } catch {
      /* Socket may not be available in tests */
    }

    console.log(
      `[Settlement] Auction settled: ${auctionId.toString()} → ` +
        `winner: ${winnerId.toString()}, price: ${finalPrice}`,
    );
  } catch (error) {
    await session.abortTransaction();

    // Revert to "active" so it can be retried on the next cycle
    await AuctionModel.updateOne(
      { _id: auctionId, status: "processing" },
      { $set: { status: "active" } },
    );

    const message = error instanceof Error ? error.message : "Unknown settlement error";
    console.error(`[Settlement:ERROR] Failed for auction ${auctionId.toString()}: ${message}`);
  } finally {
    session.endSession();
  }
}

// ============================================================
// Process all expired auctions (with distributed lock)
// ============================================================

async function processExpiredAuctions(): Promise<void> {
  // Distributed lock: only one instance processes settlements at a time
  const lockKey = "lock:settlement";
  const lockValue = crypto.randomUUID();
  const lockAcquired = await acquireLock(lockKey, lockValue, 25);

  if (!lockAcquired) {
    return; // Another instance is processing — silently skip
  }

  try {
    const now = new Date();
    const expiredAuctions: Types.ObjectId[] = [];

    // Atomically claim each expired auction: active → processing
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const auction = await AuctionModel.findOneAndUpdate(
        { status: "active", endsAt: { $lte: now } },
        { $set: { status: "processing" } },
        { new: false },
      );

      if (!auction) break;

      expiredAuctions.push(auction._id);
    }

    if (expiredAuctions.length === 0) return;

    console.log(`[Settlement] Processing ${expiredAuctions.length} expired auction(s)`);

    for (const auctionId of expiredAuctions) {
      await settleAuction(auctionId);
    }

    console.log("[Settlement] Cycle complete");
  } finally {
    await releaseLock(lockKey, lockValue);
  }
}

// ============================================================
// Cron job entry point
// ============================================================

export function startSettlementJob(): void {
  cron.schedule("*/30 * * * * *", () => {
    processExpiredAuctions().catch((error) => {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Settlement:ERROR] Job error: ${message}`);
    });
  });

  console.log("[Settlement] Cron job started (every 30 seconds)");
}
