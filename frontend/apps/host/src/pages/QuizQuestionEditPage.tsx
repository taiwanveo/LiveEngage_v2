/** Quiz 子題編輯（對齊 Poll Builder；各狀態皆可編輯內容）。 */

import * as React from "react";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatUserFacingError } from "@liveengage/realtime";
import { useSystemNotice } from "@liveengage/ui";
import { HostRoomDetailBreadcrumb } from "../components/HostBreadcrumb";
import { HostShell } from "../components/HostShell";
import { listInteractions } from "../lib/interactionApi";
import { HostTitleLink, HostTitleActions } from "../components/HostTitleActions";
import { listQuizQuestions, updateQuizQuestion } from "../lib/sprint9Api";
import { quizQuestionStateLabel } from "../lib/pollTypes";

interface Props {
  roomId: string;
  quizId: string;
  questionId: string;
  onLogout: () => void;
}

interface OptionDraft {
  text: string;
  is_correct: boolean;
}

export function QuizQuestionEditPage({
  roomId,
  quizId,
  questionId,
  onLogout,
}: Props): React.JSX.Element {
  const qc = useQueryClient();
  const { showError, showSuccess, systemNoticeModal } = useSystemNotice();
  const questionsQuery = useQuery({
    queryKey: ["quiz-questions", quizId],
    queryFn: () => listQuizQuestions(quizId),
  });

  const question = questionsQuery.data?.find((q) => q.id === questionId) ?? null;

  const [title, setTitle] = useState("");
  const [timeLimit, setTimeLimit] = useState(30);
  const [basePoints, setBasePoints] = useState(100);
  const [speedBonus, setSpeedBonus] = useState(true);
  const [explanation, setExplanation] = useState("");
  const [options, setOptions] = useState<OptionDraft[]>([]);

  useEffect(() => {
    if (!questionsQuery.isLoading && !question) {
      showError("找不到子題");
    }
  }, [questionsQuery.isLoading, question, showError]);

  useEffect(() => {
    if (!question) return;
    setTitle(question.title ?? "");
    setTimeLimit(question.time_limit_s);
    setBasePoints(question.base_points);
    setSpeedBonus(question.speed_bonus);
    setExplanation(question.explanation ?? "");
    setOptions(
      question.options.map((o) => ({
        text: o.text,
        is_correct: o.is_correct === true,
      }))
    );
  }, [question]);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateQuizQuestion(questionId, {
        title: title.trim(),
        time_limit_s: timeLimit,
        base_points: basePoints,
        speed_bonus: speedBonus,
        ...(explanation.trim() ? { explanation: explanation.trim() } : {}),
        options: options.map((o, i) => ({
          text: o.text.trim(),
          is_correct: o.is_correct,
          order_no: i,
        })),
      }),
    onSuccess: () => {
      showSuccess("已儲存");
      void qc.invalidateQueries({ queryKey: ["quiz-questions", quizId] });
      window.location.hash = backHref;
    },
    onError: (err: unknown) => {
      showError(formatUserFacingError(err, "儲存失敗"));
    },
  });

  const backHref = `#/rooms/${roomId}/workbench/${quizId}`;

  const metaQuery = useQuery({
    queryKey: ["interactions", roomId],
    queryFn: () => listInteractions(roomId),
  });
  const quizMeta = metaQuery.data?.find((i) => i.id === quizId);
  const quizTitle = quizMeta?.title?.trim() || "Quiz";

  const editBreadcrumb = (
    <HostRoomDetailBreadcrumb
      roomId={roomId}
      sectionLabel="Quiz 管理"
      sectionSegment="sprint9"
      segments={[
        {
          label: metaQuery.isLoading ? "載入中…" : quizTitle,
          href: backHref,
        },
        {
          label: question?.title?.trim() || "編輯子題",
        },
      ]}
    />
  );

  if (questionsQuery.isLoading) {
    return (
      <HostShell
        title="編輯 Quiz 子題"
        roomId={roomId}
        onLogout={onLogout}
        activeNav="sprint9"
        breadcrumb={editBreadcrumb}
      >
        <p className="text-sm text-muted">載入中…</p>
      </HostShell>
    );
  }

  if (!question) {
    return (
      <HostShell
        title="編輯 Quiz 子題"
        roomId={roomId}
        onLogout={onLogout}
        activeNav="sprint9"
        breadcrumb={editBreadcrumb}
      >
        {systemNoticeModal}
      </HostShell>
    );
  }

  return (
    <HostShell
      title="編輯 Quiz 子題"
      roomId={roomId}
      onLogout={onLogout}
      activeNav="sprint9"
      breadcrumb={editBreadcrumb}
      titleAddon={
        <HostTitleActions>
          <HostTitleLink href={backHref} variant="primary">
            本題工作台
          </HostTitleLink>
        </HostTitleActions>
      }
    >
      {question.state !== "pending" ? (
        <p className="mb-4 text-sm text-warning">
          此子題狀態為「{quizQuestionStateLabel(question.state)}
          」。若已有參與者作答，修改題目或選項可能與既有紀錄不一致；重新「開始」會清除此子題作答並重算排行榜。
        </p>
      ) : null}
      <section className="le-card mx-auto max-w-2xl space-y-4 p-6">
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-foreground">題目</span>
          <input
            className="le-input w-full"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-foreground">限時（秒）</span>
            <input
              type="number"
              min={5}
              max={300}
              className="le-input w-full"
              value={timeLimit}
              onChange={(e) => setTimeLimit(Number(e.target.value))}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-foreground">基礎分數</span>
            <input
              type="number"
              min={0}
              className="le-input w-full"
              value={basePoints}
              onChange={(e) => setBasePoints(Number(e.target.value))}
            />
          </label>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={speedBonus}
              onChange={(e) => setSpeedBonus(e.target.checked)}
            />
            <span>速度加權</span>
          </label>
        </div>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-foreground">解答說明（選填）</span>
          <textarea
            className="le-input min-h-[72px] w-full resize-y"
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
          />
        </label>

        <div>
          <p className="mb-2 text-sm font-medium text-foreground">選項（勾選正確答案）</p>
          <ul className="space-y-2">
            {options.map((opt, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correct"
                  checked={opt.is_correct}
                  onChange={() =>
                    setOptions((prev) =>
                      prev.map((o, i) => ({ ...o, is_correct: i === idx }))
                    )
                  }
                />
                <input
                  className="le-input flex-1"
                  value={opt.text}
                  onChange={(e) =>
                    setOptions((prev) =>
                      prev.map((o, i) =>
                        i === idx ? { ...o, text: e.target.value } : o
                      )
                    )
                  }
                />
                <button
                  type="button"
                  className="text-xs text-danger disabled:opacity-40"
                  disabled={options.length <= 2}
                  onClick={() =>
                    setOptions((prev) => prev.filter((_, i) => i !== idx))
                  }
                >
                  移除
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="mt-2 text-xs text-accent hover:underline"
            disabled={options.length >= 10}
            onClick={() =>
              setOptions((prev) => [...prev, { text: "", is_correct: false }])
            }
          >
            + 新增選項
          </button>
        </div>

        <button
          type="button"
          disabled={
            saveMutation.isPending ||
            !title.trim() ||
            options.some((o) => !o.text.trim()) ||
            options.filter((o) => o.is_correct).length !== 1
          }
          onClick={() => saveMutation.mutate()}
          className="le-btn-primary"
        >
          {saveMutation.isPending ? "儲存中…" : "儲存子題"}
        </button>
      </section>
      {systemNoticeModal}
    </HostShell>
  );
}
