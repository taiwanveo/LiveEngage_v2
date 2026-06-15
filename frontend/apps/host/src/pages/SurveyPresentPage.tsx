/** Survey 大螢幕投影（唯讀；問卷結果聚合）。 */

import * as React from "react";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { PRESENT_PAGE_TITLE_CLASS } from "@liveengage/ui";
import { getSurveyResults } from "../lib/sprint9Api";
import { interactionTypeLabel } from "../lib/pollTypes";

interface Props {
  surveyId: string;
  title?: string | null;
}

const BACKUP_REFETCH_MS = 8_000;

export function SurveyPresentPage({ surveyId, title }: Props): React.JSX.Element {
  const resultsQuery = useQuery({
    queryKey: ["survey-present", surveyId],
    queryFn: () => getSurveyResults(surveyId),
    refetchInterval: BACKUP_REFETCH_MS,
  });

  const questions = resultsQuery.data?.questions ?? [];
  const submissionCount = resultsQuery.data?.submission_count ?? 0;

  const heading = title?.trim() || "問卷";

  return (
    <div className="relative flex min-h-full flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-8 py-4 md:px-12">
        <h1 className={PRESENT_PAGE_TITLE_CLASS}>{heading}</h1>
        <p className="mt-2 text-sm text-slate-400">
          已完成 {submissionCount} 份 · {questions.length} 題
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-8 md:px-12 md:py-10">
        {resultsQuery.isLoading ? (
          <p className="text-center text-slate-400">載入中…</p>
        ) : questions.length === 0 ? (
          <p className="text-center text-xl text-slate-500">尚無題目或回覆</p>
        ) : (
          <ul className="mx-auto max-w-5xl space-y-8">
            {questions.map((q, index) => (
              <SurveyQuestionPresent key={q.child_interaction_id} index={index + 1} question={q} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function SurveyQuestionPresent({
  index,
  question,
}: {
  index: number;
  question: {
    child_interaction_id: string;
    title?: string | null;
    question_type?: string | null;
    response_count: number;
    option_counts?: Record<string, number> | null;
    rating_counts?: Record<string, number> | null;
  };
}): React.JSX.Element {
  const typeLabel = question.question_type
    ? interactionTypeLabel(question.question_type)
    : "題目";

  const ratingBars = useMemo(() => {
    if (!question.rating_counts) return [];
    return Object.entries(question.rating_counts)
      .map(([value, count]) => ({ value: Number(value), count }))
      .filter((row) => !Number.isNaN(row.value))
      .sort((a, b) => a.value - b.value);
  }, [question.rating_counts]);

  const optionBars = useMemo(() => {
    if (!question.option_counts) return [];
    return Object.entries(question.option_counts)
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count);
  }, [question.option_counts]);

  const maxBar = Math.max(
    1,
    ...ratingBars.map((r) => r.count),
    ...optionBars.map((o) => o.count)
  );

  return (
    <li className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 md:p-8">
      <p className="text-xs font-medium uppercase tracking-widest text-sky-400">
        第 {index} 題 · {typeLabel}
      </p>
      <h2 className="mt-3 font-display text-2xl font-bold text-white md:text-3xl">
        {question.title ?? "未命名題目"}
      </h2>
      <p className="mt-2 text-sm text-slate-400">回覆數 {question.response_count}</p>

      {ratingBars.length > 0 ? (
        <ul className="mt-6 space-y-3">
          {ratingBars.map((row) => (
            <li key={row.value}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-slate-300">{row.value} 分</span>
                <span className="tabular-nums text-slate-500">{row.count}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-sky-500 transition-all"
                  style={{ width: `${Math.round((row.count / maxBar) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {optionBars.length > 0 ? (
        <ul className="mt-6 space-y-3">
          {optionBars.map((row, idx) => (
            <li key={row.id}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-slate-300">選項 {idx + 1}</span>
                <span className="tabular-nums text-slate-500">{row.count}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all"
                  style={{ width: `${Math.round((row.count / maxBar) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {ratingBars.length === 0 && optionBars.length === 0 ? (
        <p className="mt-6 text-slate-500">尚無可視覺化的回覆資料</p>
      ) : null}
    </li>
  );
}
