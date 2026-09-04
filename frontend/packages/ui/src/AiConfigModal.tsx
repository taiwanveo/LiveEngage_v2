import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { Modal } from "./Modal";
import {
  getAiConfig,
  setAiConfig,
  clearAiConfig,
  testAiConnection,
  fetchAiModels,
  DEFAULT_AI_CONFIGS,
  type AiConfig,
  type AiProvider,
  type AiModelItem,
} from "@liveengage/realtime";

export interface AiConfigModalProps {
  open: boolean;
  onClose: () => void;
  authToken?: string | null;
}

export interface PresetModel {
  id: string;
  name: string;
  is_free?: boolean;
  group: string;
}

/** 預設各大服務商精選推薦文字模型（對話框開啟即刻可見下拉選單，無須等待遠端查詢） */
export const PRESET_MODELS: Record<AiProvider, PresetModel[]> = {
  openrouter: [
    { id: "google/gemini-2.5-flash", name: "Google: Gemini 2.5 Flash (推薦 / 快速 / 高性價比)", group: "⭐ 推薦主流文字處理模型" },
    { id: "google/gemini-2.5-flash-lite", name: "Google: Gemini 2.5 Flash Lite (極速輕量)", group: "⭐ 推薦主流文字處理模型" },
    { id: "google/gemini-2.5-pro", name: "Google: Gemini 2.5 Pro (旗艦深度推理)", group: "⭐ 推薦主流文字處理模型" },
    { id: "deepseek/deepseek-chat", name: "DeepSeek: V3 (deepseek-chat)", group: "⭐ 推薦主流文字處理模型" },
    { id: "deepseek/deepseek-r1", name: "DeepSeek: R1 (深度思考模型)", group: "⭐ 推薦主流文字處理模型" },
    { id: "openai/gpt-4o-mini", name: "OpenAI: GPT-4o mini (快速平衡)", group: "⭐ 推薦主流文字處理模型" },
    { id: "openai/gpt-4o", name: "OpenAI: GPT-4o (完整旗艦版)", group: "⭐ 推薦主流文字處理模型" },
    { id: "anthropic/claude-3.5-haiku", name: "Anthropic: Claude 3.5 Haiku", group: "⭐ 推薦主流文字處理模型" },
    { id: "anthropic/claude-3.7-sonnet", name: "Anthropic: Claude 3.7 Sonnet (新一代旗艦)", group: "⭐ 推薦主流文字處理模型" },
    { id: "meta-llama/llama-3.3-70b-instruct", name: "Meta: Llama 3.3 70B Instruct", group: "⭐ 推薦主流文字處理模型" },
    { id: "qwen/qwen3-coder-flash", name: "Qwen: Qwen 3 Coder Flash", group: "⭐ 推薦主流文字處理模型" },
    { id: "inclusionai/ling-3.0-flash-fin:free", name: "InclusionAI: Ling 3.0 Flash Fin (免費)", is_free: true, group: "🎁 免費用量模型 (Free Tier)" },
    { id: "liquid/lfm-2.5-2.6b:free", name: "Liquid: LFM 2.5 2.6B (免費)", is_free: true, group: "🎁 免費用量模型 (Free Tier)" },
    { id: "google/gemma-4-26b-a4b-it:free", name: "Google: Gemma 4 26B (免費)", is_free: true, group: "🎁 免費用量模型 (Free Tier)" },
  ],
  gemini: [
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash (推薦 / 官方最新版)", group: "⭐ Google Gemini 常用模型" },
    { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite (極速輕量)", group: "⭐ Google Gemini 常用模型" },
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro (旗艦複雜推理)", group: "⭐ Google Gemini 常用模型" },
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash (相容穩定版)", group: "⭐ Google Gemini 常用模型" },
  ],
  openai: [
    { id: "gpt-4o-mini", name: "GPT-4o mini (推薦 / 經濟高效)", group: "⭐ OpenAI 常用模型" },
    { id: "gpt-4o", name: "GPT-4o (全功能智慧模型)", group: "⭐ OpenAI 常用模型" },
    { id: "o3-mini", name: "o3-mini (複雜邏輯推理)", group: "⭐ OpenAI 常用模型" },
    { id: "gpt-4-turbo", name: "GPT-4 Turbo", group: "⭐ OpenAI 常用模型" },
  ],
  auto: [
    { id: "google/gemini-2.5-flash", name: "Google: Gemini 2.5 Flash", group: "⭐ 常用推薦" },
    { id: "gpt-4o-mini", name: "GPT-4o mini", group: "⭐ 常用推薦" },
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", group: "⭐ 常用推薦" },
  ],
  custom: [
    { id: "llama3.2", name: "Llama 3.2 (本地 Ollama 預設)", group: "⭐ 本地相容常用" },
    { id: "qwen2.5", name: "Qwen 2.5 (本地 Ollama / vLLM)", group: "⭐ 本地相容常用" },
    { id: "deepseek-r1", name: "DeepSeek R1 (本地推理模型)", group: "⭐ 本地相容常用" },
  ],
};

export function AiConfigModal({
  open,
  onClose,
  authToken,
}: AiConfigModalProps): React.JSX.Element | null {
  const [provider, setProvider] = useState<AiProvider>("openrouter");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const [availableModels, setAvailableModels] = useState<AiModelItem[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelFilter, setModelFilter] = useState("");

  const [testStatus, setTestStatus] = useState<
    "idle" | "testing" | "success" | "error" | "warning"
  >("idle");
  const [testMsg, setTestMsg] = useState("");

  useEffect(() => {
    if (open) {
      const cfg = getAiConfig();
      setProvider(cfg.provider);
      setApiKey(cfg.apiKey);
      setModel(cfg.model);
      setBaseUrl(cfg.baseUrl);
      setTestStatus("idle");
      setTestMsg("");
      setSavedSuccess(false);
      setShowKey(false);
      setAvailableModels([]);
      setModelFilter("");
    }
  }, [open]);

  const handleProviderChange = (newProvider: AiProvider) => {
    setProvider(newProvider);
    setAvailableModels([]);
    setModelFilter("");
    const defaults = DEFAULT_AI_CONFIGS[newProvider];
    if (defaults) {
      setModel(defaults.defaultModel);
      setBaseUrl(defaults.defaultBaseUrl);
    }
  };

  const handleTest = async () => {
    setTestStatus("testing");
    setTestMsg("正在驗證 LLM 模型連線並查詢最新模型清單…");

    const result = await testAiConnection(
      {
        apiKey: apiKey.trim(),
        provider,
        model: model.trim(),
        baseUrl: baseUrl.trim(),
      },
      authToken
    );

    if (result.models && result.models.length > 0) {
      setAvailableModels(result.models);
    }

    if (result.status === "ok") {
      setTestStatus("success");
      setTestMsg(result.message);
    } else if (result.status === "warning") {
      setTestStatus("warning");
      setTestMsg(result.message);
    } else {
      setTestStatus("error");
      setTestMsg(result.message);
    }
  };

  const handleFetchModels = async () => {
    setLoadingModels(true);
    setTestStatus("testing");
    setTestMsg("正在取得最新模型清單…");

    const result = await fetchAiModels(
      {
        apiKey: apiKey.trim(),
        provider,
        baseUrl: baseUrl.trim(),
      },
      authToken
    );

    setLoadingModels(false);
    if (result.models && result.models.length > 0) {
      setAvailableModels(result.models);
      setTestStatus("success");
      setTestMsg(`成功載入 ${result.models.length} 個可用文字處理模型，已整合至下方下拉選單！`);
    } else {
      setTestStatus("error");
      setTestMsg(result.message || "未能獲取模型清單");
    }
  };

  const handleSave = () => {
    setAiConfig({
      apiKey: apiKey.trim(),
      provider,
      model: model.trim(),
      baseUrl: baseUrl.trim(),
    });
    setSavedSuccess(true);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  const handleClear = () => {
    clearAiConfig();
    const defaults = DEFAULT_AI_CONFIGS.openrouter;
    setProvider("openrouter");
    setApiKey("");
    setModel(defaults.defaultModel);
    setBaseUrl(defaults.defaultBaseUrl);
    setAvailableModels([]);
    setModelFilter("");
    setTestStatus("idle");
    setTestMsg("已清除本地金鑰，恢復為伺服端預設或離線雙軌容錯模式");
  };

  const popularModels = DEFAULT_AI_CONFIGS[provider]?.popularModels || [];

  // 合併精選推薦模型與即時從 API 獲取的模型清單
  const combinedModels = useMemo(() => {
    const presets = PRESET_MODELS[provider] || [];
    if (availableModels.length === 0) {
      return presets;
    }
    const map = new Map<string, PresetModel>();
    for (const m of availableModels) {
      map.set(m.id, {
        id: m.id,
        name: m.name && m.name !== m.id ? `${m.name} (${m.id})` : m.id,
        is_free: m.is_free,
        group: m.is_free ? "🎁 免費用量模型 (Free Tier)" : "🌐 服務商即時可用文字模型",
      });
    }
    for (const p of presets) {
      if (!map.has(p.id)) {
        map.set(p.id, p);
      }
    }
    return Array.from(map.values());
  }, [provider, availableModels]);

  // 關鍵字即時篩選
  const filteredModels = useMemo(() => {
    if (!modelFilter.trim()) return combinedModels;
    const q = modelFilter.toLowerCase().trim();
    return combinedModels.filter(
      (m) =>
        m.id.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q)
    );
  }, [combinedModels, modelFilter]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="🤖 AI 模型與金鑰設定"
      size="4xl"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTest}
              disabled={testStatus === "testing"}
              className="le-btn-ghost !text-xs !px-3.5 !py-2"
            >
              {testStatus === "testing" ? "測試中…" : "🔍 測試連線並取得模型"}
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-muted hover:text-danger hover:underline px-1"
            >
              重設為預設
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="le-btn-ghost !text-xs !px-4 !py-2"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="le-btn-primary !text-xs !px-5 !py-2 shadow-sm font-semibold"
            >
              {savedSuccess ? "✓ 已儲存！" : "儲存設定"}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 text-sm">
        <p className="text-xs text-muted leading-relaxed">
          支援 <strong>OpenRouter（多模型推薦）</strong>、<strong>Google Gemini</strong>、
          <strong>OpenAI</strong> 或任意相容 API。
          您填寫的金鑰僅儲存於此瀏覽器本地（localStorage），呼叫 AI 功能時即時生效，安全不外洩。
        </p>

        {/* 1. Provider Selection Tabs - 寬裕版卡片 */}
        <div>
          <label className="mb-2 block text-xs font-semibold text-foreground">
            1. 選擇 AI 服務商 (Provider)
          </label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                { id: "openrouter", name: "OpenRouter", badge: "推薦", icon: "🌐", desc: "支援數百款主流模型" },
                { id: "gemini", name: "Google Gemini", badge: "", icon: "🔷", desc: "Google 原生 API" },
                { id: "openai", name: "OpenAI", badge: "", icon: "🟢", desc: "ChatGPT 原生 API" },
                { id: "custom", name: "自訂相容 API", badge: "Ollama", icon: "⚙️", desc: "本地 / vLLM / 相容" },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleProviderChange(p.id)}
                className={`relative flex flex-col items-center justify-center rounded-xl border p-3.5 text-center transition min-w-0 ${
                  provider === p.id
                    ? "border-accent bg-accent/10 font-bold text-accent shadow-sm ring-1 ring-accent/30"
                    : "border-border/80 bg-surface hover:border-accent/50 text-foreground"
                }`}
              >
                {p.badge && (
                  <span className="absolute top-2 right-2 rounded-full bg-accent/20 px-1.5 py-0.5 text-[9px] font-semibold text-accent leading-none">
                    {p.badge}
                  </span>
                )}
                <span className="text-2xl mb-1.5">{p.icon}</span>
                <span className="text-xs font-bold leading-tight break-words text-center">
                  {p.name}
                </span>
                <span className="text-[10px] text-muted mt-1 leading-tight text-center">
                  {p.desc}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 2. API Key Input */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-foreground">
              2. API Key 金鑰
            </label>
            {apiKey && (
              <button
                type="button"
                onClick={() => setApiKey("")}
                className="text-[11px] text-danger hover:underline"
              >
                清除輸入
              </button>
            )}
          </div>
          <div className="relative flex items-center">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={DEFAULT_AI_CONFIGS[provider]?.placeholder || "請輸入 API Key"}
              className="le-input w-full pr-10 font-mono text-xs"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2.5 text-muted hover:text-foreground text-xs"
              title={showKey ? "隱藏" : "顯示"}
            >
              {showKey ? "🙈" : "👁️"}
            </button>
          </div>
          <p className="mt-1 text-[11px] text-muted">
            {apiKey.startsWith("sk-or-") && provider !== "openrouter" && (
              <span className="text-accent font-medium">💡 偵測到 OpenRouter 格式金鑰</span>
            )}
            {apiKey.startsWith("AIza") && provider !== "gemini" && (
              <span className="text-accent font-medium">💡 偵測到 Google Gemini 格式金鑰</span>
            )}
            {!apiKey && (
              <span>若留空，系統將自動使用伺服端 .env 配置或離線雙軌容錯引擎。</span>
            )}
          </p>
        </div>

        {/* 3. Model Selection Dropdown & Custom Input (永遠可見下拉選單) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-foreground flex items-center gap-2">
              <span>3. 模型名稱 (Model Name)</span>
              {availableModels.length > 0 ? (
                <span className="rounded bg-accent/15 px-2 py-0.5 text-[10px] font-mono text-accent font-semibold">
                  ✓ 已載入 {availableModels.length} 個即時模型
                </span>
              ) : (
                <span className="rounded bg-surface-elevated border border-border px-2 py-0.5 text-[10px] text-muted">
                  精選推薦清單 ({combinedModels.length})
                </span>
              )}
            </label>
            <button
              type="button"
              onClick={handleFetchModels}
              disabled={loadingModels || testStatus === "testing"}
              className="text-xs text-accent hover:underline inline-flex items-center gap-1 font-medium disabled:opacity-50"
              title="由服務商 API 即時抓取最新可用文字模型清單"
            >
              <span>{loadingModels ? "⏳ 讀取中…" : "🔄 讀取即時完整模型清單"}</span>
            </button>
          </div>

          <div className="space-y-2.5 rounded-xl border border-border/80 bg-surface/60 p-3.5 shadow-sm">
            {/* 關鍵字快速篩選 */}
            {combinedModels.length > 8 && (
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={modelFilter}
                  onChange={(e) => setModelFilter(e.target.value)}
                  placeholder="🔍 快速篩選模型（例如：flash, gpt, free, deepseek, claude）..."
                  className="le-input w-full !text-xs !py-1.5 pr-8"
                />
                {modelFilter && (
                  <button
                    type="button"
                    onClick={() => setModelFilter("")}
                    className="absolute right-2.5 text-xs text-muted hover:text-foreground"
                    title="清除搜尋"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}

            {/* 模型下拉式選單：無論何時皆直接顯示 */}
            <div>
              <label className="block text-[11px] font-medium text-muted mb-1">
                ▼ 模型下拉式選單（點擊即可切換模型）：
              </label>
              <select
                value={combinedModels.some((m) => m.id === model) ? model : "__custom__"}
                onChange={(e) => {
                  if (e.target.value && e.target.value !== "__custom__") {
                    setModel(e.target.value);
                  }
                }}
                className="le-input w-full font-mono text-xs cursor-pointer bg-surface py-2 border-accent/40 font-medium"
              >
                <option value="">
                  {combinedModels.some((m) => m.id === model)
                    ? `-- 切換模型 (目前已選: ${model}) --`
                    : `-- 請從下拉選單挑選模型 (${filteredModels.length} 個選項) --`}
                </option>

                {/* Free models group */}
                {filteredModels.some((m) => m.is_free) && (
                  <optgroup label="🎁 免費用量模型 (Free Tier)">
                    {filteredModels
                      .filter((m) => m.is_free)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} [免費]
                        </option>
                      ))}
                  </optgroup>
                )}

                {/* Recommended models group */}
                {filteredModels.some((m) => !m.is_free && m.group.includes("推薦")) && (
                  <optgroup label="⭐ 推薦主流文字處理模型">
                    {filteredModels
                      .filter((m) => !m.is_free && m.group.includes("推薦"))
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                  </optgroup>
                )}

                {/* Other models group */}
                {filteredModels.some((m) => !m.is_free && !m.group.includes("推薦")) && (
                  <optgroup label={`🌐 更多可用文字模型 (${filteredModels.filter((m) => !m.is_free && !m.group.includes("推薦")).length})`}>
                    {filteredModels
                      .filter((m) => !m.is_free && !m.group.includes("推薦"))
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                  </optgroup>
                )}

                <option value="__custom__">✎ 自訂輸入模型 ID...</option>
              </select>
            </div>

            {/* 目前選用之模型 ID 輸入框 */}
            <div className="flex items-center gap-2 pt-1 border-t border-border/50">
              <span className="text-[11px] text-muted shrink-0 font-medium">目前模型 ID：</span>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="例如：google/gemini-2.5-flash"
                className="le-input flex-1 font-mono text-xs bg-surface"
              />
            </div>
          </div>

          {/* 常用快捷按鈕 */}
          {popularModels.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-muted">常用快捷：</span>
              {popularModels.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setModel(m)}
                  className={`rounded-full border px-2.5 py-0.5 text-[10px] font-mono transition ${
                    model === m
                      ? "border-accent bg-accent/15 text-accent font-semibold"
                      : "border-border/70 text-muted hover:border-accent hover:text-foreground"
                  }`}
                >
                  {m.split("/").pop()}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Base URL (Optional / Advanced) */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-foreground">
            4. API 伺服器位址 (Base URL)
          </label>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="例如：https://openrouter.ai/api/v1"
            className="le-input w-full font-mono text-xs text-muted"
          />
        </div>

        {/* Test Result Alert */}
        {testStatus !== "idle" && (
          <div
            className={`rounded-xl border p-3 text-xs ${
              testStatus === "testing"
                ? "border-accent/40 bg-accent/10 text-foreground animate-pulse"
                : testStatus === "success"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                : testStatus === "warning"
                ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200"
                : "border-danger/40 bg-danger/10 text-danger"
            }`}
          >
            <div className="flex items-start gap-2">
              <span className="text-sm">
                {testStatus === "testing" && "⏳"}
                {testStatus === "success" && "✅"}
                {testStatus === "warning" && "ℹ️"}
                {testStatus === "error" && "⚠️"}
              </span>
              <span className="flex-1 break-all leading-relaxed font-mono">{testMsg}</span>
            </div>
          </div>
        )}

      </div>
    </Modal>
  );
}

export interface AiConfigTriggerProps {
  className?: string;
  compact?: boolean;
  label?: string;
}

export function AiConfigTrigger({
  className = "",
  compact = false,
  label = "AI 設定",
}: AiConfigTriggerProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const cfg = getAiConfig();
      setHasKey(Boolean(cfg.apiKey));
    }
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`relative inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-surface/80 px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:border-accent hover:bg-accent/10 hover:text-accent shadow-sm ${className}`}
        title={`AI 模型與金鑰設定（${hasKey ? "自訂金鑰已生效" : "伺服端/離線模式"}）`}
      >
        <span className="text-sm">🤖</span>
        {!compact && <span>{label}</span>}
        <span className="text-[11px] text-muted">⚙️</span>
        {hasKey && (
          <span
            className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-surface"
            title="自訂金鑰已生效"
          />
        )}
      </button>

      <AiConfigModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
