import { NextFunction, Request, Response, Router } from "express";
import { z } from "zod";

import { authGuard } from "../middleware/authGuard";
import { AuctionService } from "../services/AuctionService";

const router = Router();

const listAuctionsQuerySchema = z.object({
  category: z.string().trim().min(1).optional(),
  q: z.string().trim().min(1).optional(),
  status: z.enum(["active", "processing", "sold", "expired", "cancelled"]).optional(),
  sort: z.enum(["endingSoon", "priceLowToHigh", "priceHighToLow"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

const createAuctionSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  description: z.string().trim().min(1, "Description is required").max(2000),
  category: z.string().trim().min(1, "Category is required").max(100),
  startingPrice: z.coerce.number().positive("Starting price must be greater than zero"),
  endsAt: z.coerce.date(),
  images: z.array(z.string().trim().min(1)).min(1, "At least one image is required").max(10),
});

const updateAuctionSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().min(1).max(2000).optional(),
    category: z.string().trim().min(1).max(100).optional(),
    endsAt: z.coerce.date().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, "At least one field must be provided");

router.get("/", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const query = listAuctionsQuerySchema.parse(req.query);
    const data = await AuctionService.listAuctions(query);

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const auctionId = z.string().parse(req.params.id);
    const data = await AuctionService.getAuctionById(auctionId);

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/", authGuard, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = createAuctionSchema.parse(req.body);
    const data = await AuctionService.createAuction({
      ...payload,
      sellerId: req.user!._id.toString(),
    });

    res.status(201).json({
      success: true,
      message: "Auction created successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
});

router.patch(
  "/:id",
  authGuard,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auctionId = z.string().parse(req.params.id);
      const payload = updateAuctionSchema.parse(req.body);
      const data = await AuctionService.updateAuction(auctionId, {
        ...payload,
        sellerId: req.user!._id.toString(),
      });

      res.status(200).json({
        success: true,
        message: "Auction updated successfully",
        data,
      });
    } catch (error) {
      next(error);
    }
  },
);

router.delete(
  "/:id",
  authGuard,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auctionId = z.string().parse(req.params.id);
      const result = await AuctionService.deleteAuction(auctionId, req.user!._id.toString());

      res.status(200).json({
        success: true,
        message: result.message,
        data: result.deletedAuction,
      });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/:id/cancel",
  authGuard,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const auctionId = z.string().parse(req.params.id);
      const data = await AuctionService.cancelAuction(auctionId, req.user!._id.toString());

      res.status(200).json({
        success: true,
        message: "Auction cancelled successfully",
        data,
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
