import OpenAI from "openai";

export function createOpenAiClient() {
  if (!process.env.OPENAI_API_KEY) {
    const error = new Error('OPENAI_API_KEY is required for AI fallback');
    error.code = 'AI_NOT_CONFIGURED';
    error.retryable = false;
    throw error;
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}
