import http from "http";

import jwt, { JwtPayload } from "jsonwebtoken";
import { createAdapter } from "@socket.io/redis-adapter";
import { Server, Socket } from "socket.io";

import { env } from "../config/env";
import { getRedisClientsForAdapter } from "../utils/redis";

import { registerAuctionHandler } from "./handlers/auctionHandler";

type AuthTokenPayload = JwtPayload & {
  userId: string;
};

let io: Server | null = null;

export function getIO(): Server {
  if (!io) {
    throw new Error("Socket.IO has not been initialized");
  }
  return io;
}

export function initializeSocketIO(httpServer: http.Server): Server {
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  // Attach Redis adapter for horizontal scaling (if Redis is configured)
  const redisClients = getRedisClientsForAdapter();
  if (redisClients) {
    io.adapter(createAdapter(redisClients.pubClient, redisClients.subClient));
    console.log("[Socket.IO] Redis adapter attached (multi-instance ready)");
  } else {
    console.log("[Socket.IO] Running in single-instance mode (no Redis adapter)");
  }

  // JWT authentication middleware
  io.use((socket: Socket, next) => {
    try {
      const token = socket.handshake.auth.token as string | undefined;

      if (!token) {
        return next(new Error("Authentication token is required"));
      }

      const decoded = jwt.verify(token, env.JWT_SECRET);

      if (typeof decoded === "string" || !("userId" in decoded)) {
        return next(new Error("Invalid authentication token"));
      }

      const payload = decoded as AuthTokenPayload;
      socket.data.user = { userId: payload.userId };
      next();
    } catch {
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const userId = socket.data.user?.userId as string;
    console.log(`[Socket.IO] Connected: ${socket.id} (user: ${userId})`);

    socket.join(`user:${userId}`);

    registerAuctionHandler(io!, socket);

    socket.on("disconnect", (reason: string) => {
      console.log(`[Socket.IO] Disconnected: ${socket.id} (reason: ${reason})`);
    });
  });

  console.log("[Socket.IO] Initialized");
  return io;
}
