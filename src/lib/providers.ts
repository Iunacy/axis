export type AiProviderId = "anthropic" | "openai" | "gemini";

export interface BuiltRequest {
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

interface BuildOpts {
  key: string;
  system: string;
  user: string;
  model?: string;
  maxTokens?: number;
  browser: boolean;
}

const DEFAULT_MAX_TOKENS = 4096;

export interface AiProvider {
  id: AiProviderId;
  label: string;
  placeholder: string;
  defaultModel: string;
  consoleUrl: string;
  envVar: string;
  buildRequest(opts: BuildOpts): BuiltRequest;
  extractText(json: unknown): string;
}

const ANTHROPIC_MODEL = "claude-sonnet-4-6";
const OPENAI_MODEL = "gpt-4o";
const GEMINI_MODEL = "gemini-2.0-flash";

const anthropic: AiProvider = {
  id: "anthropic",
  label: "Anthropic (Claude)",
  placeholder: "sk-ant-…",
  defaultModel: ANTHROPIC_MODEL,
  consoleUrl: "https://console.anthropic.com/settings/keys",
  envVar: "ANTHROPIC_API_KEY",
  buildRequest({ key, system, user, model, maxTokens, browser }) {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    };
    if (browser) headers["anthropic-dangerous-direct-browser-access"] = "true";
    return {
      url: "https://api.anthropic.com/v1/messages",
      headers,
      body: {
        model: model || ANTHROPIC_MODEL,
        max_tokens: maxTokens ?? DEFAULT_MAX_TOKENS,
        system,
        messages: [{ role: "user", content: user }],
      },
    };
  },
  extractText(json) {
    const content = (json as { content?: { type: string; text?: string }[] }).content;
    return content?.find((b) => b.type === "text")?.text ?? "";
  },
};

const openai: AiProvider = {
  id: "openai",
  label: "OpenAI (GPT)",
  placeholder: "sk-…",
  defaultModel: OPENAI_MODEL,
  consoleUrl: "https://platform.openai.com/api-keys",
  envVar: "OPENAI_API_KEY",
  buildRequest({ key, system, user, model, maxTokens }) {
    return {
      url: "https://api.openai.com/v1/chat/completions",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: {
        model: model || OPENAI_MODEL,
        max_tokens: maxTokens ?? DEFAULT_MAX_TOKENS,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      },
    };
  },
  extractText(json) {
    const choices = (json as { choices?: { message?: { content?: string } }[] }).choices;
    return choices?.[0]?.message?.content ?? "";
  },
};

const gemini: AiProvider = {
  id: "gemini",
  label: "Google (Gemini)",
  placeholder: "AIza…",
  defaultModel: GEMINI_MODEL,
  consoleUrl: "https://aistudio.google.com/apikey",
  envVar: "GEMINI_API_KEY",
  buildRequest({ key, system, user, model, maxTokens }) {
    const m = model || GEMINI_MODEL;
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`,
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": key,
      },
      body: {
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: maxTokens ?? DEFAULT_MAX_TOKENS,
        },
      },
    };
  },
  extractText(json) {
    const parts = (
      json as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
    ).candidates?.[0]?.content?.parts;
    return Array.isArray(parts) ? parts.map((p) => p.text ?? "").join("") : "";
  },
};

export const AI_PROVIDERS: AiProvider[] = [anthropic, openai, gemini];

export const DEFAULT_PROVIDER_ID: AiProviderId = "anthropic";

export function isProviderId(v: unknown): v is AiProviderId {
  return AI_PROVIDERS.some((p) => p.id === v);
}

export function getProvider(id: AiProviderId | string | undefined | null): AiProvider {
  return AI_PROVIDERS.find((p) => p.id === id) ?? anthropic;
}

export function modelEnvVar(id: AiProviderId): string {
  return `${id.toUpperCase()}_MODEL`;
}
