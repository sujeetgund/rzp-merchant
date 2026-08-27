import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

declare global {
  var __rzpCheckpointer: PostgresSaver | undefined;
  var __rzpCheckpointerReady: Promise<void> | undefined;
}

export async function getCheckpointer(): Promise<PostgresSaver> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env first.");
  }

  if (!globalThis.__rzpCheckpointer) {
    globalThis.__rzpCheckpointer = PostgresSaver.fromConnString(url);
  }
  if (!globalThis.__rzpCheckpointerReady) {
    globalThis.__rzpCheckpointerReady = globalThis.__rzpCheckpointer.setup();
  }
  await globalThis.__rzpCheckpointerReady;
  return globalThis.__rzpCheckpointer;
}
