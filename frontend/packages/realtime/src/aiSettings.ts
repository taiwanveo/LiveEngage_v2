/**
 * AI 設定與自訂金鑰管理（支援 OpenRouter / OpenAI / Gemini / 自訂相容 API）。
 * 主持人設定之金鑰安全保存於瀏覽器 localStorage，並透過 HTTP Headers 傳遞給後端。
 */

import { apiUrl } from "./apiBase";

export type AiProvider = "auto" | "openrouter" | "openai" | "gemini" | "custom";

export interface AiConfig {
  apiKey: string;
  provider: AiProvider;
  model: string;
  baseUrl: string;
}

export const STORAGE_KEY_AI_CONFIG = "liveengage_ai_config";

export const DEFAULT_AI_CONFIGS: Record<
  AiProvider,
  { defaultModel: string; defaultBaseUrl: string; label: string; placeholder: string; popularModels: string[] }
> = {
  openrouter: {
    label: "OpenRouter（多模型推薦）",
    defaultModel: "google/gemini-2.5-flash",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    placeholder: "sk-or-v1-...",
    popularModels: [
      "google/gemini-2.5-flash",
      "google/gemini-2.5-flash-lite",
      "deepseek/deepseek-chat",
      "openai/gpt-4o-mini",
      "anthropic/claude-3.5-haiku",
      "meta-llama/llama-3.3-70b-instruct",
    ],
  },
  gemini: {
    label: "Google Gemini",
    defaultModel: "gemini-2.5-flash",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    placeholder: "AIzaSy...",
    popularModels: ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro", "gemini-2.0-flash"],
  },
  openai: {
    label: "OpenAI",
    defaultModel: "gpt-4o-mini",
    defaultBaseUrl: "https://api.openai.com/v1",
    placeholder: "sk-...",
    popularModels: ["gpt-4o-mini", "gpt-4o"],
  },
  auto: {
    label: "自動辨識 Provider",
    defaultModel: "google/gemini-2.5-flash",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    placeholder: "輸入任意相容 API Key",
    popularModels: ["google/gemini-2.5-flash", "gpt-4o-mini", "gemini-2.5-flash"],
  },
  custom: {
    label: "自訂相容 API（如 Ollama / vLLM）",
    defaultModel: "",
    defaultBaseUrl: "",
    placeholder: "API Key（若無可留空）",
    popularModels: [],
  },
};

export function getAiConfig(): AiConfig {
  if (typeof window === "undefined" || !window.localStorage) {
    return {
      apiKey: "",
      provider: "openrouter",
      model: "google/gemini-2.5-flash",
      baseUrl: "https://openrouter.ai/api/v1",
    };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_AI_CONFIG);
    if (!raw) {
      return {
        apiKey: "",
        provider: "openrouter",
        model: "google/gemini-2.5-flash",
        baseUrl: "https://openrouter.ai/api/v1",
      };
    }
    const parsed = JSON.parse(raw) as Partial<AiConfig>;
    const provider = parsed.provider || "openrouter";
    return {
      apiKey: (parsed.apiKey || "").trim(),
      provider,
      model: (parsed.model || "").trim() || DEFAULT_AI_CONFIGS[provider]?.defaultModel || "google/gemini-2.5-flash",
      baseUrl: (parsed.baseUrl || "").trim() || DEFAULT_AI_CONFIGS[provider]?.defaultBaseUrl || "https://openrouter.ai/api/v1",
    };
  } catch {
    return {
      apiKey: "",
      provider: "openrouter",
      model: "google/gemini-2.5-flash",
      baseUrl: "https://openrouter.ai/api/v1",
    };
  }
}

export function setAiConfig(config: Partial<AiConfig>): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  const current = getAiConfig();
  const next: AiConfig = {
    apiKey: config.apiKey !== undefined ? config.apiKey.trim() : current.apiKey,
    provider: config.provider || current.provider,
    model: config.model !== undefined ? config.model.trim() : current.model,
    baseUrl: config.baseUrl !== undefined ? config.baseUrl.trim() : current.baseUrl,
  };
  window.localStorage.setItem(STORAGE_KEY_AI_CONFIG, JSON.stringify(next));
}

export function clearAiConfig(): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.removeItem(STORAGE_KEY_AI_CONFIG);
}

export function getAiHeaders(): Record<string, string> {
  const config = getAiConfig();
  if (!config.apiKey) {
    return {};
  }
  const headers: Record<string, string> = {
    "X-AI-API-Key": config.apiKey,
    "X-AI-Provider": config.provider,
  };
  if (config.model) headers["X-AI-Model"] = config.model;
  if (config.baseUrl) headers["X-AI-Base-Url"] = config.baseUrl;
  return headers;
}

export interface AiModelItem {
  id: string;
  name: string;
  description?: string | null;
  context_length?: number | null;
  is_free?: boolean;
}

export interface AiModelsResponse {
  status: "ok" | "error" | "warning";
  message: string;
  provider?: string;
  models: AiModelItem[];
}

export interface TestAiConnectionResult {
  status: "ok" | "error" | "warning";
  message: string;
  provider?: string;
  model?: string;
  suggested_model?: string;
  latency_ms: number;
  models?: AiModelItem[];
}

export async function testAiConnection(
  config: AiConfig,
  authToken?: string | null
): Promise<TestAiConnectionResult> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const res = await fetch(apiUrl("/api/v1/ai/test-connection"), {
      method: "POST",
      headers,
      body: JSON.stringify({
        api_key: config.apiKey,
        provider: config.provider,
        model: config.model,
        base_url: config.baseUrl,
      }),
    });

    const data = await res.json();
    return {
      status: data.status || (res.ok ? "ok" : "error"),
      message: data.message || (res.ok ? "連線測試成功！" : `連線失敗 (HTTP ${res.status})`),
      provider: data.provider || config.provider,
      model: data.model || config.model,
      latency_ms: typeof data.latency_ms === "number" ? data.latency_ms : 0,
      models: Array.isArray(data.models) ? data.models : [],
    };
  } catch (err: unknown) {
    return {
      status: "error",
      message: `連線請求異常：${err instanceof Error ? err.message : String(err)}`,
      latency_ms: 0,
      models: [],
    };
  }
}

export async function fetchAiModels(
  config: Partial<AiConfig>,
  authToken?: string | null
): Promise<AiModelsResponse> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const res = await fetch(apiUrl("/api/v1/ai/models"), {
      method: "POST",
      headers,
      body: JSON.stringify({
        api_key: config.apiKey || "",
        provider: config.provider || "auto",
        base_url: config.baseUrl || "",
      }),
    });

    const data = await res.json();
    return {
      status: data.status || (res.ok ? "ok" : "error"),
      message: data.message || (res.ok ? "已載入可用模型清單" : `載入失敗 (HTTP ${res.status})`),
      provider: data.provider || config.provider,
      models: Array.isArray(data.models) ? data.models : [],
    };
  } catch (err: unknown) {
    return {
      status: "error",
      message: `載入模型清單異常：${err instanceof Error ? err.message : String(err)}`,
      models: [],
    };
  }
}
