/** Poll 讀取 API（投影端僅 GET，不做寫入）。 */

import { api } from "./api";
import type { PollDetail, PollResults } from "@liveengage/renderers";

export async function getPoll(pollId: string): Promise<PollDetail> {
  return api<PollDetail>(`/api/v1/polls/${pollId}`);
}

export async function getPollResults(pollId: string): Promise<PollResults> {
  return api<PollResults>(`/api/v1/polls/${pollId}/results`);
}
