/** 互動項目 API（BE-002 / BE-003）。 */

import { api } from "./api";
import type { InteractionSummary, PollInteractionType } from "./pollTypes";

export type Sprint9InteractionType = "quiz" | "ideas" | "survey";

export type QaInteractionType = "qa";

export type InteractionCreateType = PollInteractionType | Sprint9InteractionType | QaInteractionType;

export async function listInteractions(
  roomId: string
): Promise<InteractionSummary[]> {
  return api<InteractionSummary[]>(`/api/v1/rooms/${roomId}/interactions`);
}

export async function createInteraction(
  roomId: string,
  payload: {
    type: InteractionCreateType;
    title?: string;
    description?: string;
    settings?: Record<string, unknown>;
  }
): Promise<InteractionSummary> {
  return api<InteractionSummary>(`/api/v1/rooms/${roomId}/interactions`, {
    method: "POST",
    body: payload,
  });
}

export async function updateInteractionStatus(
  interactionId: string,
  status: "idle" | "active" | "locked" | "stopped"
): Promise<InteractionSummary> {
  return api<InteractionSummary>(`/api/v1/interactions/${interactionId}`, {
    method: "PATCH",
    body: { status },
  });
}

/** 房間內最新的 Q&A 互動（對齊後端 get_qa_interaction）。 */
export function findLatestQaInteraction(
  items: InteractionSummary[]
): InteractionSummary | null {
  const qaItems = items.filter((i) => i.type === "qa");
  if (qaItems.length === 0) return null;
  return qaItems.reduce((latest, item) =>
    item.created_at > latest.created_at ? item : latest
  );
}

export async function updateInteraction(
  interactionId: string,
  payload: {
    title?: string;
    description?: string;
    settings?: Record<string, unknown>;
    result_visible?: boolean;
  }
): Promise<InteractionSummary> {
  return api<InteractionSummary>(`/api/v1/interactions/${interactionId}`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteInteraction(interactionId: string): Promise<void> {
  await api<void>(`/api/v1/interactions/${interactionId}`, {
    method: "DELETE",
  });
}
