import * as React from "react";
import { useState, useEffect } from "react";
import { Modal } from "./Modal";

export interface ServerConfigModalProps {
  open: boolean;
  onClose: () => void;
  defaultApiBase?: string;
}

const STORAGE_KEY = "liveengage_api_base";
const FALLBACK_DEFAULT = "https://theft-him-runs-feel.trycloudflare.com";

export function ServerConfigModal({
  open,
  onClose,
  defaultApiBase = FALLBACK_DEFAULT,
}: ServerConfigModalProps): React.JSX.Element | null {
  const [customUrl, setCustomUrl] = useState("");
  const [testStatus, setTestStatus] = useState<
    "idle" | "testing" | "success" | "error"
  >("idle");
  const [testMsg, setTestMsg] = useState("");

  useEffect(() => {
    if (open && typeof window !== "undefined") {
      const stored = window.localStorage.getItem(STORAGE_KEY) || "";
      setCustomUrl(stored);
      setTestStatus("idle");
      setTestMsg("");
    }
  }, [open]);

  const activeUrl =
    customUrl.trim() ||
    (typeof window !== "undefined" &&
    (window.location.hostname.endsWith(".pages.dev") ||
      window.location.hostname.includes("pages.dev"))
      ? defaultApiBase
      : "同源預設（本地代理）");

  async function handleTest(urlToTest: string) {
    const isPages =
      typeof window !== "undefined" &&
      (window.location.hostname.endsWith(".pages.dev") ||
        window.location.hostname.includes("pages.dev"));
    const target = urlToTest.trim() || (isPages ? defaultApiBase : "");
    if (!target) {
      setTestStatus("error");
      setTestMsg("未指定網址");
      return;
    }
    setTestStatus("testing");
    setTestMsg("連線測試中…");
    try {
      const normalized = target.replace(/\/$/, "");
      const res = await fetch(`${normalized}/health`, {
        method: "GET",
        mode: "cors",
      });
      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          status?: string;
          env?: string;
        };
        setTestStatus("success");
        setTestMsg(
          `✅ 連線成功！狀態：${data.status ?? "ok"}（環境：${
            data.env ?? "prod"
          }）`
        );
      } else {
        setTestStatus("error");
        setTestMsg(`❌ 伺服器回應錯誤（HTTP ${res.status}）`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "網路錯誤或 CORS 阻擋";
      setTestStatus("error");
      setTestMsg(`❌ 無法連線至此伺服器（${msg}）`);
    }
  }

  function handleSave() {
    if (typeof window === "undefined") return;
    const trimmed = customUrl.trim().replace(/\/$/, "");
    if (trimmed) {
      window.localStorage.setItem(STORAGE_KEY, trimmed);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    window.location.reload();
  }

  function handleReset() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  }

  return (
    <Modal open={open} onClose={onClose} title="⚙️ 後端 API 伺服器設定">
      <div className="space-y-4 text-sm">
        <p className="text-muted leading-relaxed">
          當前部署於靜態主機（如 Cloudflare Pages）時，前端需指定後端 API 伺服器網址以進行登入與即時互動。
        </p>

        <div className="rounded-md border border-border bg-surface-elevated p-3">
          <div className="text-xs text-muted">目前使用端點：</div>
          <div className="mt-1 font-mono text-xs font-semibold text-primary break-all">
            {activeUrl}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground mb-1">
            自訂後端伺服器網址 (API Base URL)：
          </label>
          <input
            type="text"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder={defaultApiBase}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono"
          />
          <div className="mt-1 flex items-center justify-between text-xs text-muted">
            <span>支援 Tunnel、Zeabur、自架 API 或 localhost</span>
            <button
              type="button"
              onClick={() => setCustomUrl(defaultApiBase)}
              className="text-primary hover:underline text-xs"
            >
              填入預設 Tunnel
            </button>
          </div>
        </div>

        {testStatus !== "idle" && (
          <div
            className={`rounded-md p-2.5 text-xs ${
              testStatus === "success"
                ? "bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/30"
                : testStatus === "error"
                ? "bg-destructive/10 text-destructive border border-destructive/30"
                : "bg-surface-elevated text-muted border border-border"
            }`}
          >
            {testMsg}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleTest(customUrl)}
              disabled={testStatus === "testing"}
              className="le-btn-secondary text-xs px-3 py-1.5"
            >
              {testStatus === "testing" ? "測試中…" : "🔍 測試連線"}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-muted hover:text-foreground px-2 py-1.5"
            >
              重設回預設
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="le-btn-secondary text-xs px-3 py-1.5"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="le-btn-primary text-xs px-3 py-1.5"
            >
              儲存並重新整理
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function ServerConfigTrigger({
  defaultApiBase = FALLBACK_DEFAULT,
  className = "",
}: {
  defaultApiBase?: string;
  className?: string;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors ${className}`}
      >
        <span>⚙️ API 伺服器設定</span>
      </button>
      <ServerConfigModal
        open={open}
        onClose={() => setOpen(false)}
        defaultApiBase={defaultApiBase}
      />
    </>
  );
}
