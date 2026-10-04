import { connectRedis } from "../services/redis-connection.js";

const KEY_PATTERNS = ["naja:*", "bull:*"];

async function deleteByPattern(
  redis: Awaited<ReturnType<typeof connectRedis>>,
  pattern: string,
): Promise<number> {
  let deleted = 0;
  const stream = redis.scanStream({ match: pattern, count: 100 });

  stream.on("data", (keys: string[]) => {
    if (keys.length > 0) {
      stream.pause();
      void redis
        .del(...keys)
        .then((count) => {
          deleted += count;
        })
        .catch((error: unknown) => {
          stream.destroy(error as Error);
        })
        .finally(() => {
          stream.resume();
        });
    }
  });

  await new Promise<void>((resolve, reject) => {
    stream.on("end", () => resolve());
    stream.on("error", (error: unknown) => reject(error));
  });

  return deleted;
}

async function clearRedis(): Promise<void> {
  const flushAll = process.argv.includes("--all");
  const redis = await connectRedis(
    process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
  );

  try {
    if (flushAll) {
      await redis.flushdb();
      console.log("Redis database flushed (FLUSHDB).");
      return;
    }

    let total = 0;
    for (const pattern of KEY_PATTERNS) {
      const deleted = await deleteByPattern(redis, pattern);
      console.log(`Deleted ${deleted} key(s) matching "${pattern}".`);
      total += deleted;
    }
    console.log(`Done. ${total} key(s) deleted.`);
  } finally {
    redis.disconnect();
  }
}

void clearRedis().catch((error: unknown) => {
  console.error("Failed to clear Redis:", error);
  process.exitCode = 1;
});
