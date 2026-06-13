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
