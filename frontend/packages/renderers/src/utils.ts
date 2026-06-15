import type { InteractionStatus, PollDetail, RenderMode } from "./types";

export function modeLabel(mode: RenderMode): string {
  switch (mode) {
    case "answer":
      return "作答";
    case "present":
      return "投影";
    case "preview":
      return "預覽";
  }
}

export function statusLabel(status: InteractionStatus): string {
  switch (status) {
    case "idle":
      return "未開始";
    case "active":
      return "進行中";
    case "locked":
      return "已鎖定";
    case "stopped":
      return "已結束";
  }
}

/** 投影模式狀態膠囊（高對比、依狀態配色）。 */
export function presentStatusBadgeClass(status: InteractionStatus): string {
  switch (status) {
    case "active":
      return "rounded-full bg-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-100 ring-1 ring-emerald-400/50";
    case "locked":
      return "rounded-full bg-amber-500/30 px-3 py-1 text-xs font-semibold text-amber-100 ring-1 ring-amber-400/50";
    case "stopped":
      return "rounded-full bg-red-500/30 px-3 py-1 text-xs font-semibold text-red-100 ring-1 ring-red-400/50";
    case "idle":
      return "rounded-full bg-slate-500/30 px-3 py-1 text-xs font-semibold text-slate-200 ring-1 ring-slate-400/40";
  }
}

export function canAnswer(
  status: InteractionStatus,
  mySubmitted: boolean,
  allowChange: boolean
): boolean {
  if (status !== "active") return false;
  if (mySubmitted && !allowChange) return false;
  return true;
}

/** 參與者作答模式：進行中且尚未提交時，不應以結果圖表取代作答 UI。 */
export function shouldShowParticipantResults(
  poll: Pick<PollDetail, "status" | "result_visible" | "my_submitted">,
  hasResultsData: boolean,
  opts?: { hostWorkbenchPreview?: boolean }
): boolean {
  if (!poll.result_visible) return false;
  if (opts?.hostWorkbenchPreview) return true;
  if (!hasResultsData) return false;
  if (poll.status === "active" && !poll.my_submitted) return false;
  return true;
}

/** 是否顯示選項正解標記（預覽／編輯模式除外，須已揭曉結果）。 */
export function shouldShowCorrectAnswer(
  mode: RenderMode,
  poll: Pick<PollDetail, "result_visible">
): boolean {
  if (mode === "preview") return true;
  return poll.result_visible;
}

export function readBool(
  settings: Record<string, unknown>,
  key: string,
  fallback = false
): boolean {
  const v = settings[key];
  return typeof v === "boolean" ? v : fallback;
}

export function readNumber(
  settings: Record<string, unknown>,
  key: string,
  fallback: number
): number {
  const v = settings[key];
  return typeof v === "number" ? v : fallback;
}
