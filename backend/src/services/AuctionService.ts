import mongoose, { FilterQuery, Types } from "mongoose";

import { AuctionDocument, AuctionModel } from "../models/Auction";
import { BidModel } from "../models/Bid";
import { uploadImages } from "../utils/cloudinary";
import { AppError } from "../utils/errors";

type SortOption = "endingSoon" | "priceLowToHigh" | "priceHighToLow";

export type ListAuctionsInput = {
  category?: string;
  q?: string;
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
  static async listActiveAuctions(input: ListAuctionsInput) {
    const filter: FilterQuery<AuctionDocument> = {
      status: "active",
      endsAt: { $gt: new Date() },
    };

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
    const imageUrls = await uploadImages(input.images);

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
}
