/** Poll / Interaction 型別（對齊 backend schemas）。 */

export type PollInteractionType =
  | "multiple_choice"
  | "word_cloud"
  | "open_text"
  | "rating"
  | "ranking";

export type InteractionStatus = "idle" | "active" | "locked" | "stopped";

/** Poll／Quiz 等互動是否視為進行中（含 locked 揭曉態）。 */
export function isPollRunning(status: InteractionStatus): boolean {
  return status === "active" || status === "locked";
}

export type PollAction =
  | "start"
  | "stop"
  | "lock"
  | "unlock"
  | "reveal"
  | "hide"
  | "reset";

export interface InteractionSummary {
  id: string;
  room_id: string;
  type: string;
  title: string | null;
  description: string | null;
  status: InteractionStatus;
  order_no: number;
  settings: Record<string, unknown>;
  result_visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface PollOptionInput {
  text: string;
  is_correct?: boolean;
  order_no?: number;
}

import type { PollResults } from "@liveengage/renderers";

export interface PollActionResponse {
  poll_id: string;
  status: InteractionStatus;
  result_visible: boolean;
  /** reveal 時後端附帶結果快照 */
  results?: PollResults | null;
}

export const POLL_TYPES: { value: PollInteractionType; label: string }[] = [
  { value: "multiple_choice", label: "選擇題" },
  { value: "word_cloud", label: "文字雲" },
  { value: "open_text", label: "開放文字" },
  { value: "rating", label: "評分" },
  { value: "ranking", label: "排序" },
];

export const POLL_TYPE_SET = new Set<string>(POLL_TYPES.map((t) => t.value));

export function isPollType(type: string): type is PollInteractionType {
  return POLL_TYPE_SET.has(type);
}

const POLL_TYPE_LABEL_MAP = Object.fromEntries(
  POLL_TYPES.map((t) => [t.value, t.label])
) as Record<PollInteractionType, string>;

/** 所有互動題型（含 Q&A、Sprint 9） */
export const INTERACTION_TYPE_LABEL: Record<string, string> = {
  ...POLL_TYPE_LABEL_MAP,
  qa: "Q&A 問答",
  quiz: "快問快答",
  ideas: "點子牆",
  survey: "問卷",
};

export const INTERACTION_STATUS_LABEL: Record<InteractionStatus, string> = {
  idle: "閒置",
  active: "進行中",
  locked: "已鎖定",
  stopped: "已結束",
};

/** Quiz 子題狀態 */
export const QUIZ_QUESTION_STATE_LABEL: Record<string, string> = {
  pending: "待開始",
  active: "進行中",
  revealed: "已揭曉",
  closed: "已結束",
};

/** 題型顯示名稱（中文） */
export function pollTypeLabel(type: string): string {
  return interactionTypeLabel(type);
}

/** 互動題型顯示名稱（中文） */
export function interactionTypeLabel(type: string): string {
  return INTERACTION_TYPE_LABEL[type] ?? type;
}

/** 互動狀態顯示名稱（中文） */
export function interactionStatusLabel(status: InteractionStatus | string): string {
  return INTERACTION_STATUS_LABEL[status as InteractionStatus] ?? status;
}

/** Quiz 子題狀態顯示名稱（中文） */
export function quizQuestionStateLabel(state: string): string {
  return QUIZ_QUESTION_STATE_LABEL[state] ?? state;
}

/** Sprint 9 互動工作台頁標題（對齊 Poll 工作台命名）。 */
export function interactionWorkbenchTitle(type: string): string {
  switch (type) {
    case "quiz":
      return "Quiz 工作台";
    case "ideas":
      return "Ideas 工作台";
    case "survey":
      return "Survey 工作台";
    default:
      return "工作台";
  }
}

/** @deprecated 請改用 interactionWorkbenchTitle */
export const interactionConsoleTitle = interactionWorkbenchTitle;

/** 「題型 · 狀態」摘要列 */
export function interactionMetaLine(
  type: string,
  status: InteractionStatus | string,
  extra?: string
): string {
  const base = `${interactionTypeLabel(type)} · ${interactionStatusLabel(status)}`;
  return extra ? `${base} · ${extra}` : base;
}
