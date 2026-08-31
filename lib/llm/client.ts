import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";

export const EMBEDDING_DIMENSIONS = 1536;

export function getChatModel(): ChatOpenAI {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    throw new Error(
      "LLM_API_KEY is not set. Add it to .env to enable the AI sales agent.",
    );
  }
  return new ChatOpenAI({
    apiKey,
    model: process.env.LLM_MODEL ?? "gpt-4o-mini",
    temperature: 0.4,
    configuration: {
      baseURL: process.env.LLM_BASE_URL ?? "https://api.openai.com/v1",
    },
  });
}

export function getEmbeddingsModel(): OpenAIEmbeddings {
  const apiKey = process.env.EMBEDDING_API_KEY;
  if (!apiKey) {
    throw new Error("EMBEDDING_API_KEY is not set.");
  }
  return new OpenAIEmbeddings({
    apiKey,
    model: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",
    dimensions: EMBEDDING_DIMENSIONS,
    configuration: {
      baseURL: process.env.EMBEDDING_BASE_URL ?? "https://api.openai.com/v1",
    },
  });
}

export async function embedText(text: string): Promise<number[]> {
  return getEmbeddingsModel().embedQuery(text);
}

export function isLlmConfigured(): boolean {
  return Boolean(process.env.LLM_API_KEY);
}

export function isEmbeddingConfigured(): boolean {
  return Boolean(process.env.EMBEDDING_API_KEY);
}
