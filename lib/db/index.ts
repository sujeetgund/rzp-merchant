import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  var __rzpPostgresClient: ReturnType<typeof postgres> | undefined;
}

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env first.");
  }
  return postgres(url, { max: 10 });
}

const client = globalThis.__rzpPostgresClient ?? createClient();
if (process.env.NODE_ENV !== "production") {
  globalThis.__rzpPostgresClient = client;
}

export const db = drizzle(client, { schema });
export { client as sqlClient };
