/** Poll API（FE-006~010、BE-003/005）。 */

import { api, newIdempotencyKey } from "./api";
import type {
  PollAction,
  PollActionResponse,
  PollOptionInput,
} from "./pollTypes";
import type { PollDetail, PollResults } from "@liveengage/renderers";

export async function getPoll(pollId: string): Promise<PollDetail> {
  return api<PollDetail>(`/api/v1/polls/${pollId}`);
}

export async function getPollResults(pollId: string): Promise<PollResults> {
  return api<PollResults>(`/api/v1/polls/${pollId}/results`);
}

export async function updatePollOptions(
  pollId: string,
  options: PollOptionInput[]
): Promise<void> {
  await api(`/api/v1/polls/${pollId}/options`, {
    method: "PUT",
    body: { options },
  });
}

export async function pollAction(
  pollId: string,
  action: PollAction,
  confirm = false
): Promise<PollActionResponse> {
  return api<PollActionResponse>(`/api/v1/polls/${pollId}/actions`, {
    method: "POST",
    body: { action, confirm },
    idempotencyKey: newIdempotencyKey(),
  });
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

export async function toggleAiCluster(
  pollId: string,
  enabled: boolean,
  forceRefresh = false
): Promise<PollResults> {
  return api<PollResults>(`/api/v1/polls/${pollId}/ai-cluster`, {
    method: "POST",
    body: { enabled, force_refresh: forceRefresh },
  });
}

export async function manualMergeCluster(
  pollId: string,
  sourceWord: string,
  targetWord: string
): Promise<PollResults> {
  return api<PollResults>(`/api/v1/polls/${pollId}/clusters/merge`, {
    method: "POST",
    body: { source_word: sourceWord, target_word: targetWord },
  });
}

export async function manualSplitCluster(
  pollId: string,
  clusterWord: string,
  variantWord: string
): Promise<PollResults> {
  return api<PollResults>(`/api/v1/polls/${pollId}/clusters/split`, {
    method: "POST",
    body: { cluster_word: clusterWord, variant_word: variantWord },
  });
}


