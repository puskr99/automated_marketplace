import OpenAI from "openai";

// Groq's free tier (OpenAI-compatible) powers the verification agents.
// Swap this for Anthropic/OpenAI/etc. later by changing baseURL/apiKey/model
// — the call sites use the standard chat.completions shape either way.
export const llm = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

export const VERIFICATION_MODEL = "llama-3.3-70b-versatile";
