/** Poll / Interaction 型別（對齊 backend schemas）。 */

export type PollInteractionType =
  | "multiple_choice"
  | "word_cloud"
  | "open_text"
  | "rating"
  | "ranking";

export type InteractionStatus = "idle" | "active" | "locked" | "stopped";

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

export interface PollActionResponse {
  poll_id: string;
  status: InteractionStatus;
  result_visible: boolean;
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

export const INTERACTION_STATUS_LABEL: Record<InteractionStatus, string> = {
  idle: "閒置",
  active: "進行中",
  locked: "已鎖定",
  stopped: "已結束",
};

/** 題型顯示名稱（中文） */
export function pollTypeLabel(type: string): string {
  if (isPollType(type)) return POLL_TYPE_LABEL_MAP[type];
  return type;
}

/** 互動狀態顯示名稱（中文） */
export function interactionStatusLabel(status: InteractionStatus): string {
  return INTERACTION_STATUS_LABEL[status] ?? status;
}
