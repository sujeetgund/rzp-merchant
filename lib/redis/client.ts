import Redis from "ioredis";

declare global {
  var __rzpRedisClient: Redis | undefined;
}

function createClient() {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL is not set. Copy .env.example to .env first.");
  }
  return new Redis(url, { maxRetriesPerRequest: 3, lazyConnect: false });
}

export const redis = globalThis.__rzpRedisClient ?? createClient();
if (process.env.NODE_ENV !== "production") {
  globalThis.__rzpRedisClient = redis;
}
