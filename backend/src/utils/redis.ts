import Redis from "ioredis";

import { env } from "../config/env";

// ============================================================
// Mock Redis Client (single-instance fallback for development)
// ============================================================

type StoredEntry = {
  value: string;
  timeout: NodeJS.Timeout | null;
};

class MockRedisClient {
  private readonly store = new Map<string, StoredEntry>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key)?.value ?? null;
  }

  async del(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return 0;
    if (entry.timeout) clearTimeout(entry.timeout);
    this.store.delete(key);
    return 1;
  }

  async incr(key: string): Promise<number> {
    const entry = this.store.get(key);
    const current = entry ? parseInt(entry.value, 10) || 0 : 0;
    const next = current + 1;
    if (entry) {
      entry.value = String(next);
    } else {
      this.store.set(key, { value: String(next), timeout: null });
    }
    return next;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return 0;
    if (entry.timeout) clearTimeout(entry.timeout);
    entry.timeout = setTimeout(() => this.store.delete(key), seconds * 1000);
    return 1;
  }

  async setNX(key: string, value: string, expirySeconds: number): Promise<boolean> {
    if (this.store.has(key)) return false;
    const timeout = setTimeout(() => this.store.delete(key), expirySeconds * 1000);
    this.store.set(key, { value, timeout });
    return true;
  }
}

// ============================================================
// Client Initialization
// ============================================================

const mockClient = new MockRedisClient();

let primaryClient: Redis | null = null;
let subscriberClient: Redis | null = null;
let redisInitialized = false;

function ensureRedis(): void {
  if (redisInitialized) return;
  redisInitialized = true;

  const url = env.REDIS_URL;
  if (!url) {
    console.log("[Redis] No REDIS_URL configured — using in-memory mock (single-instance only)");
    return;
  }

  primaryClient = new Redis(url, { maxRetriesPerRequest: 3 });
  subscriberClient = primaryClient.duplicate();

  primaryClient.on("error", (err) => console.error("[Redis:pub]", err.message));
  subscriberClient.on("error", (err) => console.error("[Redis:sub]", err.message));
  primaryClient.on("connect", () => console.log("[Redis] Primary client connected"));
}

/**
 * Returns ioredis pub/sub clients for the Socket.IO Redis adapter.
 * Returns null when no REDIS_URL is configured (single-instance mode).
 */
export function getRedisClientsForAdapter(): { pubClient: Redis; subClient: Redis } | null {
  ensureRedis();
  if (!primaryClient || !subscriberClient) return null;
  return { pubClient: primaryClient, subClient: subscriberClient };
}

// ============================================================
// Distributed Lock Operations
// ============================================================

export async function acquireLock(key: string, value: string, seconds = 5): Promise<boolean> {
  ensureRedis();
  if (primaryClient) {
    const res = await primaryClient.set(key, value, "EX", seconds, "NX");
    return res === "OK";
  }
  return mockClient.setNX(key, value, seconds);
}

export async function releaseLock(key: string, _value?: string): Promise<boolean> {
  ensureRedis();
  if (primaryClient) {
    const res = await primaryClient.del(key);
    return res > 0;
  }
  const res = await mockClient.del(key);
  return res > 0;
}

// ============================================================
// Rate Limiting
// ============================================================

/**
 * Sliding-window rate limiter using Redis INCR + EXPIRE.
 * Returns true if the request is within the limit, false if exceeded.
 */
export async function checkBidRateLimit(
  userId: string,
  auctionId: string,
  limit = 5,
  windowSeconds = 10,
): Promise<boolean> {
  const key = `ratelimit:bid:${userId}:${auctionId}`;
  ensureRedis();

  if (primaryClient) {
    const count = await primaryClient.incr(key);
    if (count === 1) {
      await primaryClient.expire(key, windowSeconds);
    }
    return count <= limit;
  }

  const count = await mockClient.incr(key);
  if (count === 1) {
    await mockClient.expire(key, windowSeconds);
  }
  return count <= limit;
}
