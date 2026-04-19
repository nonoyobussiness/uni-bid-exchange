import mongoose, { Types } from "mongoose";

import { TransactionModel } from "../models/Transaction";
import { WalletModel } from "../models/Wallet";
import { AppError } from "../utils/errors";

export type PaginationInput = {
  page: number;
  limit: number;
};

export class WalletService {
  static async getWalletSummary(userId: string, pagination: PaginationInput) {
    const wallet = await WalletModel.findOne({ userId }).lean();
    if (!wallet) {
      throw new AppError(404, "Wallet not found");
    }

    const skip = (pagination.page - 1) * pagination.limit;
    const [transactions, total] = await Promise.all([
      TransactionModel.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pagination.limit)
        .lean(),
      TransactionModel.countDocuments({ userId }),
    ]);

    return {
      wallet,
      transactions,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / pagination.limit)),
      },
    };
  }

  static async buyFunds(userId: string, amount: number) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const wallet = await WalletModel.findOne({ userId }).session(session);
      if (!wallet) {
        throw new AppError(404, "Wallet not found");
      }

      wallet.balance += amount;
      wallet.totalDeposited += amount;
      await wallet.save({ session });

      await TransactionModel.create(
        [
          {
            userId: new Types.ObjectId(userId),
            type: "credit",
            amount,
            description: "Wallet top-up",
            status: "completed",
          },
        ],
        { session },
      );

      await session.commitTransaction();
      return wallet.toObject();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  static async withdrawFunds(userId: string, amount: number) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const wallet = await WalletModel.findOne({ userId }).session(session);
      if (!wallet) {
        throw new AppError(404, "Wallet not found");
      }

      if (wallet.balance < amount) {
        throw new AppError(400, "Insufficient available balance");
      }

      wallet.balance -= amount;
      wallet.totalSpent += amount;
      await wallet.save({ session });

      await TransactionModel.create(
        [
          {
            userId: new Types.ObjectId(userId),
            type: "debit",
            amount,
            description: "Wallet withdrawal",
            status: "completed",
          },
        ],
        { session },
      );

      await session.commitTransaction();
      return wallet.toObject();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
}
