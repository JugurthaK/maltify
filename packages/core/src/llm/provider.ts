import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { getConfig } from "../config.js";

/**
 * Resolve the configured LLM. Provider-agnostic by design: swap providers via
 * LLM_PROVIDER/LLM_MODEL in .env without touching call sites.
 */
export function getModel(): LanguageModel {
  const config = getConfig();
  switch (config.LLM_PROVIDER) {
    case "anthropic": {
      if (!config.ANTHROPIC_API_KEY) {
        throw new Error("ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic");
      }
      const anthropic = createAnthropic({ apiKey: config.ANTHROPIC_API_KEY });
      return anthropic(config.LLM_MODEL);
    }
    case "openai": {
      if (!config.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY is required when LLM_PROVIDER=openai");
      }
      const openai = createOpenAI({ apiKey: config.OPENAI_API_KEY });
      return openai(config.LLM_MODEL);
    }
  }
}

export function getModelName(): string {
  const config = getConfig();
  return `${config.LLM_PROVIDER}/${config.LLM_MODEL}`;
}
