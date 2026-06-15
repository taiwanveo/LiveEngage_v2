/** 參與者 Q&A React Query 快取：樂觀更新與 WS 合併。 */

import type { QueryClient } from "@tanstack/react-query";
import type { QuestionListResponse, QuestionPublic, VoteResult } from "./qaApi";
import { sortQuestionsTop } from "./qaSort";

export function qaPublicQueryKey(roomId: string): readonly ["qa-public", string] {
  return ["qa-public", roomId] as const;
}

type VotePatch = Pick<
  QuestionPublic,
  "upvote_count" | "downvote_count" | "score" | "my_vote"
>;

export function patchQuestionVotes(
  data: QuestionListResponse | undefined,
  questionId: string,
  patch: Partial<VotePatch>
): QuestionListResponse | undefined {
  if (!data) return data;
  const items = data.items.map((q) =>
    q.id === questionId ? { ...q, ...patch } : q
  );
  return { ...data, items: sortQuestionsTop(items) };
}

export function applyOptimisticUpvote(
  data: QuestionListResponse | undefined,
  questionId: string
): QuestionListResponse | undefined {
  if (!data) return data;
  const target = data.items.find((q) => q.id === questionId);
  if (!target || target.my_vote === "up") return data;
  return patchQuestionVotes(data, questionId, {
    upvote_count: target.upvote_count + 1,
    downvote_count: target.downvote_count,
    score: target.score + 1,
    my_vote: "up",
  });
}

export function reconcileVoteResult(
  data: QuestionListResponse | undefined,
  result: VoteResult
): QuestionListResponse | undefined {
  return patchQuestionVotes(data, result.question_id, {
    upvote_count: result.upvote_count,
    downvote_count: result.downvote_count,
    score: result.score,
    my_vote: result.my_vote,
  });
}

export function patchQaVoteFromWs(
  queryClient: QueryClient,
  roomId: string,
  payload: Record<string, unknown>
): void {
  const questionId =
    typeof payload.question_id === "string" ? payload.question_id : null;
  const upvoteCount =
    typeof payload.upvote_count === "number" ? payload.upvote_count : null;
  const downvoteCount =
    typeof payload.downvote_count === "number" ? payload.downvote_count : null;
  const score = typeof payload.score === "number" ? payload.score : null;
  if (!questionId || upvoteCount === null || downvoteCount === null || score === null) {
    return;
  }

  queryClient.setQueryData<QuestionListResponse>(
    qaPublicQueryKey(roomId),
    (old) =>
      patchQuestionVotes(old, questionId, {
        upvote_count: upvoteCount,
        downvote_count: downvoteCount,
        score,
      })
  );
}
