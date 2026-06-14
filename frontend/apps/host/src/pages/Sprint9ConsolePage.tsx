/** Sprint 9 現場控制台：Quiz 控場 / Ideas 列表 / Survey 結果。 */

import * as React from "react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HostShell } from "../components/HostShell";
import { listInteractions } from "../lib/interactionApi";
import {
  addQuizQuestion,
  getQuizLeaderboard,
  getSurveyResults,
  hideIdea,
  listIdeas,
  listQuizQuestions,
  quizAction,
  addSurveyQuestion,
} from "../lib/sprint9Api";

interface Props {
  roomId: string;
  interactionId: string;
  onLogout: () => void;
}

export function Sprint9ConsolePage({
  roomId,
  interactionId,
  onLogout,
}: Props): React.JSX.Element {
  const qc = useQueryClient();
  const [quizTitle, setQuizTitle] = useState("");

  const metaQuery = useQuery({
    queryKey: ["interactions", roomId],
    queryFn: () => listInteractions(roomId),
  });
  const item = metaQuery.data?.find((i) => i.id === interactionId);

  const questionsQuery = useQuery({
    queryKey: ["quiz-questions", interactionId],
    queryFn: () => listQuizQuestions(interactionId),
    enabled: item?.type === "quiz",
  });

  const leaderboardQuery = useQuery({
    queryKey: ["quiz-leaderboard", interactionId],
    queryFn: () => getQuizLeaderboard(interactionId),
    enabled: item?.type === "quiz",
    refetchInterval: 5_000,
  });

  const ideasQuery = useQuery({
    queryKey: ["ideas", interactionId],
    queryFn: () => listIdeas(interactionId),
    enabled: item?.type === "ideas",
    refetchInterval: 4_000,
  });

  const surveyResultsQuery = useQuery({
    queryKey: ["survey-results", interactionId],
    queryFn: () => getSurveyResults(interactionId),
    enabled: item?.type === "survey",
    refetchInterval: 8_000,
  });

  const addQuestionMutation = useMutation({
    mutationFn: () =>
      addQuizQuestion(interactionId, {
        title: quizTitle.trim() || "新題目",
        options: [
          { text: "A", is_correct: true, order_no: 0 },
          { text: "B", is_correct: false, order_no: 1 },
        ],
      }),
    onSuccess: () => {
      setQuizTitle("");
      void qc.invalidateQueries({ queryKey: ["quiz-questions", interactionId] });
    },
  });

  const actionMutation = useMutation({
    mutationFn: ({
      questionId,
      action,
    }: {
      questionId: string;
      action: "start_question" | "reveal" | "close";
    }) => quizAction(questionId, action),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["quiz-questions", interactionId] });
      void qc.invalidateQueries({ queryKey: ["quiz-leaderboard", interactionId] });
    },
  });

  const hideMutation = useMutation({
    mutationFn: hideIdea,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["ideas", interactionId] }),
  });

  const addSurveyQMutation = useMutation({
    mutationFn: () =>
      addSurveyQuestion(interactionId, {
        title: "滿意度（1–5）",
        question_type: "rating",
        required: true,
      }),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["survey-results", interactionId] }),
  });

  if (!item) {
    return (
      <HostShell title="Sprint 9 控制台" roomId={roomId} onLogout={onLogout}>
        <p className="text-sm text-muted">載入中…</p>
      </HostShell>
    );
  }

  return (
    <HostShell
      title={`${item.title ?? item.type} 控制台`}
      subtitle={item.type}
      roomId={roomId}
      onLogout={onLogout}
      actions={
        <a
          href={`#/rooms/${roomId}/sprint9`}
          className="le-btn-secondary !min-h-0 px-3 py-1.5 text-sm"
        >
          返回列表
        </a>
      }
    >
      {item.type === "quiz" ? (
        <div className="space-y-6">
          <section className="le-card p-4">
            <h3 className="mb-3 text-sm font-semibold text-foreground">新增子題</h3>
            <div className="flex gap-2">
              <input
                value={quizTitle}
                onChange={(e) => setQuizTitle(e.target.value)}
                placeholder="題目文字"
                className="le-input flex-1"
              />
              <button
                type="button"
                disabled={addQuestionMutation.isPending}
                onClick={() => addQuestionMutation.mutate()}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm text-white"
              >
                新增
              </button>
            </div>
          </section>
          <section className="le-card p-4">
            <h3 className="mb-3 text-sm font-semibold text-foreground">子題控場</h3>
            <ul className="space-y-3">
              {(questionsQuery.data ?? []).map((q) => (
                <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                  <div>
                    <p className="font-medium text-foreground">{q.title}</p>
                    <p className="text-xs text-muted">狀態：{q.state}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        actionMutation.mutate({ questionId: q.id, action: "start_question" })
                      }
                      className="rounded bg-emerald-600 px-2 py-1 text-xs text-white"
                    >
                      開始
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        actionMutation.mutate({ questionId: q.id, action: "reveal" })
                      }
                      className="rounded bg-slate-700 px-2 py-1 text-xs text-white"
                    >
                      揭曉
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
          <section className="le-card p-4">
            <h3 className="mb-3 text-sm font-semibold text-foreground">排行榜</h3>
            <ol className="list-decimal pl-5 text-sm">
              {(leaderboardQuery.data?.entries ?? []).map((e) => (
                <li key={e.participant_id}>
                  #{e.rank} {e.display_name ?? "匿名"} — {e.total_score} 分
                </li>
              ))}
            </ol>
          </section>
        </div>
      ) : null}

      {item.type === "ideas" ? (
        <section className="le-card p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">點子列表</h3>
          <ul className="space-y-3">
            {(ideasQuery.data?.items ?? []).map((idea) => (
              <li key={idea.id} className="rounded-lg border border-border bg-surface-elevated p-3">
                <p className="text-foreground">{idea.content}</p>
                <p className="mt-1 text-xs text-muted">
                  {idea.author_display ?? "匿名"} · 👍 {idea.reaction_total}
                </p>
                <button
                  type="button"
                  onClick={() => hideMutation.mutate(idea.id)}
                  className="mt-2 text-xs text-red-600 hover:underline"
                >
                  隱藏
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {item.type === "survey" ? (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => addSurveyQMutation.mutate()}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm text-white"
          >
            新增評分題
          </button>
          <section className="le-card p-4">
            <p className="text-sm text-foreground">
              提交數：{surveyResultsQuery.data?.submission_count ?? 0}
            </p>
          </section>
        </div>
      ) : null}
    </HostShell>
  );
}
