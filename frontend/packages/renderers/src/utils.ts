import type { InteractionStatus, RenderMode } from "./types";

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
