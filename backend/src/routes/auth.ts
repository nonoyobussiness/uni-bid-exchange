import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";

import { env } from "../config/env";
import { authGuard } from "../middleware/authGuard";
import { TransactionModel } from "../models/Transaction";
import { UserDocument, UserModel } from "../models/User";
import { WalletModel } from "../models/Wallet";

const router = Router();
const INITIAL_WALLET_BALANCE = 500;
const PASSWORD_SALT_ROUNDS = 12;

const registerSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required"),
  studentId: z.string().trim().min(1, "Student ID is required"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("A valid university email is required")
    .refine((email) => email.endsWith(".edu"), "Email must use a university .edu domain"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
  university: z.string().trim().min(1, "University is required"),
  avatarUrl: z.string().trim().url("Avatar URL must be valid").optional(),
  bio: z.string().trim().max(500, "Bio cannot exceed 500 characters").optional(),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("A valid email is required"),
  password: z.string().min(1, "Password is required"),
});

type SanitizedUser = {
  id: string;
  fullName: string;
  studentId: string;
  email: string;
  university: string;
  trustScore: number;
  avatarUrl?: string;
  bio?: string;
  createdAt: Date;
};

const signToken = (userId: string): string =>
  jwt.sign({ userId }, env.JWT_SECRET, {
    expiresIn: "7d",
  });

const sanitizeUser = (user: UserDocument): SanitizedUser => ({
  id: user._id.toString(),
  fullName: user.fullName,
  studentId: user.studentId,
  email: user.email,
  university: user.university,
  trustScore: user.trustScore,
  avatarUrl: user.avatarUrl ?? undefined,
  bio: user.bio ?? undefined,
  createdAt: user.createdAt,
});

router.post("/register", async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = registerSchema.parse(req.body);

    const normalizedEmail = payload.email.toLowerCase();
    const existingUser = await UserModel.findOne({ email: normalizedEmail });
    if (existingUser) {
      res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
      return;
    }

    const passwordHash = await bcrypt.hash(payload.password, PASSWORD_SALT_ROUNDS);

    const user = await UserModel.create({
      fullName: payload.fullName,
      studentId: payload.studentId,
      email: normalizedEmail,
      passwordHash,
      university: payload.university,
      avatarUrl: payload.avatarUrl,
      bio: payload.bio,
    });

    await WalletModel.create({
      userId: user._id,
      balance: INITIAL_WALLET_BALANCE,
      held: 0,
      totalDeposited: INITIAL_WALLET_BALANCE,
      totalSpent: 0,
    });

    await TransactionModel.create({
      userId: user._id,
      type: "credit",
      amount: INITIAL_WALLET_BALANCE,
      description: "Initial wallet funding",
      status: "completed",
    });

    const token = signToken(user._id.toString());

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        token,
        user: sanitizeUser(user),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.flatten(),
      });
      return;
    }

    if (error instanceof Error && "code" in error && error.code === 11000) {
      res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Failed to register user",
    });
  }
});

router.post("/login", async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = loginSchema.parse(req.body);

    const normalizedLoginEmail = payload.email.toLowerCase();
    const user = await UserModel.findOne({ email: normalizedLoginEmail });
    if (!user) {
      res.status(401).json({ success: false, message: "Invalid email or password" });
      return;
    }

    const passwordMatches = await bcrypt.compare(payload.password, user.passwordHash);
    if (!passwordMatches) {
      res.status(401).json({ success: false, message: "Invalid email or password" });
      return;
    }

    const token = signToken(user._id.toString());

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        token,
        user: sanitizeUser(user),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.flatten(),
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Failed to log in",
    });
  }
});

router.get("/me", authGuard, async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({
    success: true,
    data: {
      user: sanitizeUser(req.user as UserDocument),
    },
  });
});

export default router;
