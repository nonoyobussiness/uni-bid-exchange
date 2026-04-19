import { NextFunction, Request, Response, Router } from "express";
import { z } from "zod";

import { authGuard } from "../middleware/authGuard";
import { UserService } from "../services/UserService";

const router = Router();

const updateProfileSchema = z
  .object({
    fullName: z.string().trim().min(1).max(120).optional(),
    bio: z.string().trim().max(500).optional(),
    avatarUrl: z.string().trim().url().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, "At least one field must be provided");

const updatePasswordSchema = z.object({
  oldPassword: z.string().min(1, "Old password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters long"),
});

const updatePrefsSchema = z
  .object({
    emailNotifications: z.boolean().optional(),
    bidUpdates: z.boolean().optional(),
    outbidAlerts: z.boolean().optional(),
    auctionReminders: z.boolean().optional(),
    marketingEmails: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, "At least one preference must be provided");

router.get("/:id", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = z.string().parse(req.params.id);
    const data = await UserService.getPublicProfile(userId);

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/me", authGuard, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = updateProfileSchema.parse(req.body);
    const data = await UserService.updateProfile(req.user!._id.toString(), payload);

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/me/password",
  authGuard,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const payload = updatePasswordSchema.parse(req.body);
      await UserService.updatePassword(req.user!._id.toString(), payload);

      res.status(200).json({
        success: true,
        message: "Password updated successfully",
      });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/me/bids",
  authGuard,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await UserService.getMyBids(req.user!._id.toString());

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/me/listings",
  authGuard,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await UserService.getMyListings(req.user!._id.toString());

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/me/prefs",
  authGuard,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await UserService.getPreferences(req.user!._id.toString());

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  "/me/prefs",
  authGuard,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const payload = updatePrefsSchema.parse(req.body);
      const data = await UserService.updatePreferences(req.user!._id.toString(), payload);

      res.status(200).json({
        success: true,
        message: "Preferences updated successfully",
        data,
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
