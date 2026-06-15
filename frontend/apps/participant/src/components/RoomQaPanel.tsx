/** 參與者 Q&A：提問與瀏覽已核准問題（樂觀重排 + FLIP 動畫）。 */

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { flushSync } from "react-dom";
import { formatUserFacingError } from "@liveengage/realtime";
import { Modal, useSystemNotice } from "@liveengage/ui";
import { QaQuestionList } from "./QaQuestionList";
import {
  applyOptimisticUpvote,
  qaPublicQueryKey,
  reconcileVoteResult,
} from "../lib/qaCache";
import { listQuestions, submitQuestion, voteQuestion } from "../lib/qaApi";
import type { QuestionListResponse } from "../lib/qaApi";

interface Props {
  roomId: string;
}

export function RoomQaPanel({ roomId }: Props): React.JSX.Element {
  const qc = useQueryClient();
  const { showError, systemNoticeModal } = useSystemNotice();
  const [content, setContent] = React.useState("");
  const [anonymous, setAnonymous] = React.useState(false);
  const [submitOk, setSubmitOk] = React.useState(false);
  const [votingId, setVotingId] = React.useState<string | null>(null);

  const questionsQuery = useQuery({
    queryKey: qaPublicQueryKey(roomId),
    queryFn: () => listQuestions(roomId, "top"),
    refetchInterval: 8_000,
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      submitQuestion(roomId, { content: content.trim(), is_anonymous: anonymous }),
    onSuccess: () => {
      setContent("");
      setSubmitOk(true);
      void qc.invalidateQueries({ queryKey: qaPublicQueryKey(roomId) });
    },
    onError: (err: unknown) => {
      setSubmitOk(false);
      showError(formatUserFacingError(err, "提交失敗"));
    },
  });

  const voteMutation = useMutation({
    mutationFn: (questionId: string) => voteQuestion(questionId, "up"),
    onMutate: async (questionId) => {
      setVotingId(questionId);
      await qc.cancelQueries({ queryKey: qaPublicQueryKey(roomId) });
      const previous = qc.getQueryData<QuestionListResponse>(qaPublicQueryKey(roomId));
      flushSync(() => {
        qc.setQueryData<QuestionListResponse>(qaPublicQueryKey(roomId), (old) =>
          applyOptimisticUpvote(old, questionId)
        );
      });
      return { previous };
    },
    onSuccess: (result) => {
      qc.setQueryData<QuestionListResponse>(qaPublicQueryKey(roomId), (old) =>
        reconcileVoteResult(old, result)
      );
    },
    onError: (err: unknown, _questionId, context) => {
      if (context?.previous) {
        qc.setQueryData(qaPublicQueryKey(roomId), context.previous);
      }
      showError(formatUserFacingError(err, "按讚失敗"));
    },
    onSettled: () => {
      setVotingId(null);
    },
  });

  const items = questionsQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <section className="le-card p-5">
        <h2 className="text-lg font-semibold text-foreground">向主持人提問</h2>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitOk(false);
            if (!content.trim()) return;
            submitMutation.mutate();
          }}
        >
          <textarea
            required
            maxLength={1000}
            rows={3}
            placeholder="輸入你的問題…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="le-input min-h-[88px] resize-y"
          />
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-accent"
            />
            匿名提問
          </label>
          <Modal
            open={submitOk}
            onClose={() => setSubmitOk(false)}
            title="已送出"
            size="sm"
          >
            <p className="text-sm text-muted">
              待主持人審核後會顯示在列表中。
            </p>
          </Modal>
          <button
            type="submit"
            disabled={submitMutation.isPending}
            className="le-btn-primary !min-h-[42px] disabled:opacity-50"
          >
            {submitMutation.isPending ? "送出中…" : "送出問題"}
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-foreground">問題列表</h2>
        {questionsQuery.isLoading ? (
          <p className="text-sm text-muted">載入中…</p>
        ) : items.length === 0 ? (
          <p className="le-card border-dashed p-8 text-center text-sm text-muted">
            成為第一個發問的人吧！
          </p>
        ) : (
          <QaQuestionList
            items={items}
            votingId={votingId}
            onVote={(questionId) => voteMutation.mutate(questionId)}
          />
        )}
      </section>
      {systemNoticeModal}
    </div>
  );
}
