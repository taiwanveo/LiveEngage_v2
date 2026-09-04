import * as React from "react";
import { useState, useEffect } from "react";
import { Modal } from "./Modal";
import {
  getAiConfig,
  setAiConfig,
  clearAiConfig,
  testAiConnection,
  DEFAULT_AI_CONFIGS,
  type AiConfig,
  type AiProvider,
} from "@liveengage/realtime";

export interface AiConfigModalProps {
  open: boolean;
  onClose: () => void;
  authToken?: string | null;
}

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
    }
  }, [open]);

  const handleProviderChange = (newProvider: AiProvider) => {
    setProvider(newProvider);
    const defaults = DEFAULT_AI_CONFIGS[newProvider];
    if (defaults) {
      setModel(defaults.defaultModel);
      setBaseUrl(defaults.defaultBaseUrl);
    }
  };

  const handleTest = async () => {
    setTestStatus("testing");
    setTestMsg("正在驗證 LLM 模型連線與 API Key…");

    const result = await testAiConnection(
      {
        apiKey: apiKey.trim(),
        provider,
        model: model.trim(),
        baseUrl: baseUrl.trim(),
      },
      authToken
    );

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
    setTestStatus("idle");
    setTestMsg("已清除本地金鑰，恢復為伺服端預設或離線雙軌容錯模式");
  };

  const popularModels = DEFAULT_AI_CONFIGS[provider]?.popularModels || [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="🤖 AI 模型與金鑰設定"
      size="2xl"
    >
      <div className="space-y-4 text-sm">
        <p className="text-xs text-muted leading-relaxed">
          支援 <strong>OpenRouter（多模型推薦）</strong>、<strong>Google Gemini</strong>、
          <strong>OpenAI</strong> 或任意相容 API。
          您填寫的金鑰僅儲存於此瀏覽器本地（localStorage），呼叫 AI 功能時即時生效，安全不外洩。
        </p>

        {/* Provider Selection Tabs */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-foreground">
            1. 選擇 AI 服務商 (Provider)
          </label>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {(
              [
                { id: "openrouter", name: "OpenRouter", badge: "推薦", icon: "🌐" },
                { id: "gemini", name: "Google Gemini", badge: "", icon: "🔷" },
                { id: "openai", name: "OpenAI", badge: "", icon: "🟢" },
                { id: "custom", name: "自訂相容", badge: "Ollama", icon: "⚙️" },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleProviderChange(p.id)}
                className={`flex flex-col items-center justify-center rounded-xl border px-3 py-2.5 text-center transition min-w-0 ${
                  provider === p.id
                    ? "border-accent bg-accent/10 font-bold text-accent shadow-sm"
                    : "border-border/80 bg-surface hover:border-accent/50 text-foreground"
                }`}
              >
                <div className="flex items-center justify-center gap-1.5 w-full min-w-0">
                  <span className="shrink-0 text-sm">{p.icon}</span>
                  <span className="text-xs font-semibold whitespace-nowrap">{p.name}</span>
                </div>
                {p.badge ? (
                  <span className="mt-1.5 inline-block rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold text-accent leading-none">
                    {p.badge}
                  </span>
                ) : (
                  <span className="mt-1.5 inline-block h-[14px] text-[10px] leading-none opacity-0 select-none">
                    &nbsp;
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* API Key Input */}
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

        {/* Model Selection / Input */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-foreground">
            3. 模型名稱 (Model Name)
          </label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="例如：google/gemini-2.0-flash-001 或 gpt-4o-mini"
            className="le-input w-full font-mono text-xs"
          />
          {popularModels.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-muted">常用快捷：</span>
              {popularModels.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setModel(m)}
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-mono transition ${
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

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/70">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTest}
              disabled={testStatus === "testing"}
              className="le-btn-ghost !text-xs !px-3 !py-1.5"
            >
              {testStatus === "testing" ? "測試中…" : "🔍 測試連線"}
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-muted hover:text-danger hover:underline"
            >
              重設為預設
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="le-btn-ghost !text-xs !px-3 !py-1.5"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="le-btn-primary !text-xs !px-4 !py-1.5"
            >
              {savedSuccess ? "✓ 已儲存！" : "儲存設定"}
            </button>
          </div>
        </div>
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
