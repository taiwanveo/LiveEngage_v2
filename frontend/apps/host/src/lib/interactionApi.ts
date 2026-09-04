/** 互動項目 API（BE-002 / BE-003）。 */

import { api, ApiException } from "./api";
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
    title?: string | null;
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
  try {
    await api<void>(`/api/v1/interactions/${interactionId}`, {
      method: "DELETE",
    });
  } catch (err: unknown) {
    // 重複刪除或列表快取殘留：後端已不存在時視為成功
    if (err instanceof ApiException && err.status === 404) {
      return;
    }
    throw err;
  }
}

/** 工作台左欄拖曳排序（須含房間內所有非 Q&A 互動 id）。 */
export async function reorderWorkbenchInteractions(
  roomId: string,
  orderedIds: string[]
): Promise<InteractionSummary[]> {
  return api<InteractionSummary[]>(
    `/api/v1/rooms/${roomId}/interactions/reorder`,
    {
      method: "PUT",
      body: { ordered_ids: orderedIds },
      idempotencyKey: crypto.randomUUID(),
    }
  );
}

export interface BatchPollCreateItem {
  title: string;
  type: string;
  description?: string | null;
  options?: string[];
  settings?: Record<string, unknown>;
}

export interface AiGeneratedPollItem {
  title: string;
  type: string;
  description?: string | null;
  options: string[];
  rationality: string;
}

export interface AiGeneratePollsResponse {
  polls: AiGeneratedPollItem[];
  result?: Record<string, unknown>;
  latency_ms: number;
}

export async function generateAiPolls(payload: {
  topic: string;
  count?: number;
  poll_type?: string;
  context?: string;
}): Promise<AiGeneratePollsResponse> {
  return api<AiGeneratePollsResponse>(`/api/v1/ai/generate-polls`, {
    method: "POST",
    body: payload,
  });
}

export async function batchCreateInteractions(
  roomId: string,
  polls: BatchPollCreateItem[]
): Promise<InteractionSummary[]> {
  return api<InteractionSummary[]>(
    `/api/v1/rooms/${roomId}/interactions/batch`,
    {
      method: "POST",
      body: { polls },
      idempotencyKey: crypto.randomUUID(),
    }
  );
}

