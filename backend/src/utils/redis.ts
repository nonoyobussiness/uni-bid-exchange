type RedisSetMode = "NX";
type RedisExpireMode = "EX";
type RedisSetResult = "OK" | null;

type StoredLock = {
  value: string;
  timeout: NodeJS.Timeout;
};

class MockRedisClient {
  private readonly locks = new Map<string, StoredLock>();

  async set(
    key: string,
    value: string,
    condition: RedisSetMode,
    expirationMode: RedisExpireMode,
    seconds: number,
  ): Promise<RedisSetResult> {
    if (condition !== "NX" || expirationMode !== "EX") {
      throw new Error("Mock redis only supports SET key value NX EX seconds");
    }

    if (!Number.isInteger(seconds) || seconds <= 0) {
      throw new Error("Lock expiration must be a positive integer");
    }

    const existingLock = this.locks.get(key);
    if (existingLock) {
      return null;
    }

    const timeout = setTimeout(() => {
      const currentLock = this.locks.get(key);
      if (currentLock?.value === value) {
        this.locks.delete(key);
      }
    }, seconds * 1000);

    this.locks.set(key, {
      value,
      timeout,
    });

    return "OK";
  }

  async del(key: string): Promise<number> {
    const existingLock = this.locks.get(key);
    if (!existingLock) {
      return 0;
    }

    clearTimeout(existingLock.timeout);
    this.locks.delete(key);
    return 1;
  }
}

export const redis = new MockRedisClient();

export async function acquireLock(key: string, value: string, seconds = 5): Promise<boolean> {
  const res = await redis.set(key, value, "NX", "EX", seconds);
  return res === "OK";
}

export async function releaseLock(key: string, _value?: string): Promise<boolean> {
  const delRes = await redis.del(key);
  return delRes > 0;
}
