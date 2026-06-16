/** Poll 作答 API（FE-006~010）。 */

import { api, newIdempotencyKey } from "./api";
import type { PollDetail, PollResults } from "@liveengage/renderers";

export async function getPoll(pollId: string): Promise<PollDetail> {
  return api<PollDetail>(`/api/v1/polls/${pollId}`);
}

export async function getPollResults(pollId: string): Promise<PollResults> {
  return api<PollResults>(`/api/v1/polls/${pollId}/results`);
}

export async function submitPollResponse(
  pollId: string,
  answer: Record<string, unknown>
): Promise<{ interaction_id: string; submission_no: number }> {
  return api(`/api/v1/polls/${pollId}/responses`, {
    method: "POST",
    body: { answer },
    idempotencyKey: newIdempotencyKey(),
  });
}

/** Poll 題型（對齊 backend InteractionType 子集）。 */
export const POLL_TYPES = new Set([
  "multiple_choice",
  "word_cloud",
  "open_text",
  "rating",
  "ranking",
]);

export function isPollType(type: string): boolean {
  return POLL_TYPES.has(type);
}
