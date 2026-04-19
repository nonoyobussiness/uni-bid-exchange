import { NextFunction, Request, Response, Router } from "express";
import { z } from "zod";

import { authGuard } from "../middleware/authGuard";
import { WalletService } from "../services/WalletService";

const router = Router();

const walletQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

const amountSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than zero"),
});

router.use(authGuard);

router.get("/", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const query = walletQuerySchema.parse(req.query);
    const data = await WalletService.getWalletSummary(req.user!._id.toString(), query);

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/buy", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = amountSchema.parse(req.body);
    const data = await WalletService.buyFunds(req.user!._id.toString(), payload.amount);

    res.status(200).json({
      success: true,
      message: "Funds added successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/withdraw", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = amountSchema.parse(req.body);
    const data = await WalletService.withdrawFunds(req.user!._id.toString(), payload.amount);

    res.status(200).json({
      success: true,
      message: "Withdrawal completed successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
