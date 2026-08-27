import { ChatOpenAI } from "@langchain/openai";
import { OpenAIEmbeddings } from "@langchain/openai";

function requireApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to .env to enable the AI sales agent."
    );
  }
  return apiKey;
}

export function getChatModel(): ChatOpenAI {
  return new ChatOpenAI({
    apiKey: requireApiKey(),
    model: process.env.LLM_MODEL ?? "gpt-4o-mini",
    temperature: 0.4,
    configuration: {
      baseURL: process.env.LLM_BASE_URL ?? "https://api.openai.com/v1",
    },
  });
}

export const EMBEDDING_DIMENSIONS = 1536;

export function getEmbeddingsModel(): OpenAIEmbeddings {
  return new OpenAIEmbeddings({
    apiKey: requireApiKey(),
    model: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",
    dimensions: EMBEDDING_DIMENSIONS,
    configuration: {
      baseURL: process.env.LLM_BASE_URL ?? "https://api.openai.com/v1",
    },
  });
}

export async function embedText(text: string): Promise<number[]> {
  const embeddings = getEmbeddingsModel();
  return embeddings.embedQuery(text);
}

export function isLlmConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}
