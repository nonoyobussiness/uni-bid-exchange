import { NextFunction, Request, Response, Router } from "express";
import { z } from "zod";

import { authGuard } from "../middleware/authGuard";
import { BidService } from "../services/BidService";

const router = Router();

const createBidSchema = z.object({
  auctionId: z.string().trim().min(1, "Auction id is required"),
  amount: z.coerce.number().positive("Bid amount must be greater than zero"),
});

router.post("/", authGuard, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = createBidSchema.parse(req.body);
    const result = await BidService.placeBid({
      auctionId: payload.auctionId,
      amount: payload.amount,
      bidderId: req.user!._id.toString(),
    });

    res.status(201).json({
      success: true,
      message: "Bid placed successfully",
      data: result.auction,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
