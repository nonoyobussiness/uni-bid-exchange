import http from "http";

import app from "./app";
import { connectDB } from "./config/db";
import { env } from "./config/env";
import { startSettlementJob } from "./jobs/settleExpired";
import { initializeSocketIO } from "./sockets";

const startServer = async (): Promise<void> => {
  try {
    await connectDB();

    const httpServer = http.createServer(app);

    initializeSocketIO(httpServer);
    startSettlementJob();

    httpServer.listen(env.PORT, () => {
      console.log(`UniBid Exchange backend running on port ${env.PORT}`);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown startup error";
    console.error(`Server failed to start: ${message}`);
    process.exit(1);
  }
};

void startServer();
