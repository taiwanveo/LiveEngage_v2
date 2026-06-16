/** Poll 讀取 API（Screen 唯讀）。 */

import { api } from "./api";
import type { PollDetail, PollResults } from "@liveengage/renderers";

export async function getPoll(pollId: string): Promise<PollDetail> {
  return api<PollDetail>(`/api/v1/polls/${pollId}`);
}

export async function getPollResults(pollId: string): Promise<PollResults> {
  return api<PollResults>(`/api/v1/polls/${pollId}/results`);
}

export const POLL_RESULTS_BACKUP_REFETCH_MS = 8_000;
