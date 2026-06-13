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
  hasResultsData: boolean
): boolean {
  if (!poll.result_visible || !hasResultsData) return false;
  if (poll.status === "active" && !poll.my_submitted) return false;
  return true;
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
