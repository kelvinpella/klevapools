import { Redis } from "ioredis";

export async function connectRedis(
  redisUrl: string,
  timeoutMs = 5000,
): Promise<Redis> {
  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      redis.ping(),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Redis connection timed out")),
          timeoutMs,
        );
      }),
    ]);
    return redis;
  } catch (error) {
    redis.disconnect();
    throw new Error("Unable to connect to Redis. Check REDIS_URL.", {
      cause: error,
    });
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}