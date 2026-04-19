import bcrypt from "bcryptjs";
import { Types } from "mongoose";

import { AuctionModel } from "../models/Auction";
import { BidModel } from "../models/Bid";
import { ReviewModel } from "../models/Review";
import { UserModel } from "../models/User";
import { AppError } from "../utils/errors";

const PASSWORD_SALT_ROUNDS = 12;

const DEFAULT_PREFERENCES = {
  emailNotifications: true,
  bidUpdates: true,
  outbidAlerts: true,
  auctionReminders: true,
  marketingEmails: false,
} as const;

type UpdateProfileInput = {
  fullName?: string;
  bio?: string;
  avatarUrl?: string;
};

type UpdatePasswordInput = {
  oldPassword: string;
  newPassword: string;
};

type UpdatePrefsInput = {
  emailNotifications?: boolean;
  bidUpdates?: boolean;
  outbidAlerts?: boolean;
  auctionReminders?: boolean;
  marketingEmails?: boolean;
};

const sanitizeUserProfile = (user: {
  _id: Types.ObjectId;
  fullName: string;
  university: string;
  trustScore: number;
  avatarUrl?: string | null;
  bio?: string | null;
  createdAt: Date;
}) => ({
  id: user._id.toString(),
  fullName: user.fullName,
  university: user.university,
  trustScore: user.trustScore,
  avatarUrl: user.avatarUrl ?? undefined,
  bio: user.bio ?? undefined,
  createdAt: user.createdAt,
});

export class UserService {
  static async getPublicProfile(userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new AppError(400, "Invalid user id");
    }

    const [user, listings, reviews] = await Promise.all([
      UserModel.findById(userId).select("-passwordHash").lean(),
      AuctionModel.find({ sellerId: userId }).sort({ createdAt: -1 }).lean(),
      ReviewModel.find({ sellerId: userId })
        .populate("reviewerId", "fullName avatarUrl university")
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    if (!user) {
      throw new AppError(404, "User not found");
    }

    return {
      user: sanitizeUserProfile(user),
      listings,
      reviews,
    };
  }

  static async updateProfile(userId: string, input: UpdateProfileInput) {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new AppError(404, "User not found");
    }

    if (input.fullName !== undefined) {
      user.fullName = input.fullName;
    }

    if (input.bio !== undefined) {
      user.bio = input.bio;
    }

    if (input.avatarUrl !== undefined) {
      user.avatarUrl = input.avatarUrl;
    }

    await user.save();
    return sanitizeUserProfile(user);
  }

  static async updatePassword(userId: string, input: UpdatePasswordInput) {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new AppError(404, "User not found");
    }

    const passwordMatches = await bcrypt.compare(input.oldPassword, user.passwordHash);
    if (!passwordMatches) {
      throw new AppError(400, "Old password is incorrect");
    }

    user.passwordHash = await bcrypt.hash(input.newPassword, PASSWORD_SALT_ROUNDS);
    await user.save();
  }

  static async getMyBids(userId: string) {
    const bids = await BidModel.find({ userId })
      .populate({
        path: "auctionId",
        populate: {
          path: "sellerId",
          select: "fullName avatarUrl university",
        },
      })
      .sort({ createdAt: -1 })
      .lean();

    const activeBids = bids.filter((bid) => {
      const auction = bid.auctionId as { status?: string; endsAt?: Date } | null;
      return auction?.status === "active" && auction?.endsAt && auction.endsAt.getTime() > Date.now();
    });

    const pastBids = bids.filter((bid) => {
      const auction = bid.auctionId as { status?: string; endsAt?: Date } | null;
      return !(
        auction?.status === "active" &&
        auction?.endsAt &&
        auction.endsAt.getTime() > Date.now()
      );
    });

    return {
      activeBids,
      pastBids,
    };
  }

  static async getMyListings(userId: string) {
    return AuctionModel.find({ sellerId: userId }).sort({ createdAt: -1 }).lean();
  }

  static async getPreferences(userId: string) {
    const user = await UserModel.findById(userId).select("preferences").lean();
    if (!user) {
      throw new AppError(404, "User not found");
    }

    return {
      ...DEFAULT_PREFERENCES,
      ...(user.preferences ?? {}),
    };
  }

  static async updatePreferences(userId: string, input: UpdatePrefsInput) {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new AppError(404, "User not found");
    }

    user.preferences = {
      ...DEFAULT_PREFERENCES,
      ...(user.preferences ?? {}),
      ...input,
    };

    await user.save();
    return user.preferences;
  }
}
