import mongoose from "mongoose";

import { env } from "./env";

// If the URI doesn't specify a DB name, MongoDB defaults to `test`.
// Your existing data (auctions/users) is in `test`, so keep this aligned.
const DEFAULT_DB_NAME = "test";

function uriHasDbName(uri: string): boolean {
  // True if there is a path segment after host(s), e.g.
  // mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/mydb?retryWrites=true
  // Note: mongodb URIs aren't always parseable via URL(), so use a conservative regex.
  return /mongodb(\+srv)?:\/\/[^/]+\/[^?/#]+/i.test(uri);
}

export const connectDB = async (): Promise<void> => {
  try {
    // If the URI doesn't include a db path (ends with .net/?...), we still want to use the
    // same logical DB (`test`) but authenticate against Atlas users' default auth DB (`admin`).
    // Otherwise Mongoose can attempt auth against `test` and fail with "bad auth".
    const opts: any = uriHasDbName(env.MONGODB_URI)
      ? {}
      : { dbName: DEFAULT_DB_NAME, authSource: "admin" };
    await mongoose.connect(env.MONGODB_URI, opts);
    console.log("MongoDB connected successfully");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown database error";
    console.error(`MongoDB connection failed: ${message}`);
    throw error;
  }
};
