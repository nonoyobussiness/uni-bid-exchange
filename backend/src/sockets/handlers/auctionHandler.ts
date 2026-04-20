import { Server, Socket } from "socket.io";
import { z } from "zod";

import { BidService } from "../../services/BidService";

const joinLeaveSchema = z.object({
  auctionId: z.string().min(1, "auctionId is required"),
});

const placeBidSchema = z.object({
  auctionId: z.string().min(1, "auctionId is required"),
  amount: z.number().positive("Bid amount must be greater than zero"),
});

export function registerAuctionHandler(io: Server, socket: Socket): void {
  const userId = socket.data.user?.userId as string;

  socket.on("joinAuction", (data: unknown) => {
    const parsed = joinLeaveSchema.safeParse(data);
    if (!parsed.success) {
      socket.emit("bid:error", {
        message: `Invalid payload: ${parsed.error.issues[0].message}`,
      });
      return;
    }

    const room = `auction:${parsed.data.auctionId}`;
    socket.join(room);
    console.log(`[Socket.IO] User ${userId} joined room ${room}`);
  });

  socket.on("leaveAuction", (data: unknown) => {
    const parsed = joinLeaveSchema.safeParse(data);
    if (!parsed.success) {
      socket.emit("bid:error", {
        message: `Invalid payload: ${parsed.error.issues[0].message}`,
      });
      return;
    }

    const room = `auction:${parsed.data.auctionId}`;
    socket.leave(room);
    console.log(`[Socket.IO] User ${userId} left room ${room}`);
  });

  socket.on("placeBid", async (data: unknown) => {
    const parsed = placeBidSchema.safeParse(data);
    if (!parsed.success) {
      socket.emit("bid:error", {
        message: `Invalid bid data: ${parsed.error.issues[0].message}`,
      });
      return;
    }

    const { auctionId, amount } = parsed.data;

    try {
      const result = await BidService.placeBid({
        auctionId,
        bidderId: userId,
        amount,
      });

      const auctionRoom = `auction:${auctionId}`;
      const auction = result.auction as Record<string, unknown>;

      io.to(auctionRoom).emit("auction:update", {
        auctionId,
        currentBid: auction.currentBid,
        bidCount: auction.bidCount,
        lastBidder: userId,
      });

      socket.emit("bid:success", {
        auctionId,
        amount,
      });

      if (result.previousHighestBidderId) {
        io.to(`user:${result.previousHighestBidderId}`).emit("outbid", {
          auctionId,
          newBid: amount,
          outbidBy: userId,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bid failed";
      socket.emit("bid:error", { message });
    }
  });
}
