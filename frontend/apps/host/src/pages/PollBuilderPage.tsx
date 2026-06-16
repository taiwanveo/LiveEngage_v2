/** Poll Builder（BE-003）：編輯題目、選項、預覽。 */

import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatUserFacingError } from "@liveengage/realtime";
import { PollRenderer, readNumber } from "@liveengage/renderers";
import { useSystemNotice } from "@liveengage/ui";
import { HostRoomDetailBreadcrumb } from "../components/HostBreadcrumb";
import { HostShell } from "../components/HostShell";
import { presentAppUrl } from "../lib/presentUrl";
import { HostTitleLink, HostTitleActions } from "../components/HostTitleActions";
import { updateInteraction } from "../lib/interactionApi";
import { getPoll, updatePollOptions } from "../lib/pollApi";
import type { PollOptionInput } from "../lib/pollTypes";
import { interactionTypeLabel } from "../lib/pollTypes";

interface Props {
  roomId: string;
  pollId: string;
  onLogout: () => void;
}

const OPTION_TYPES = new Set(["multiple_choice", "ranking"]);
const CORRECT_ANSWER_TYPES = new Set(["multiple_choice"]);
const OPTIONS_AUTOSAVE_MS = 700;

function optionsPayload(options: PollOptionInput[]): PollOptionInput[] {
  return options.map((o, i) => ({ ...o, order_no: i }));
}

function hasFilledOption(options: PollOptionInput[]): boolean {
  return options.some((o) => o.text.trim().length > 0);
}

function canAutosaveOptions(options: PollOptionInput[]): boolean {
  return options.length > 0 && options.every((o) => o.text.trim().length > 0);
}

function SaveTitleButton(props: {
  pending: boolean;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      disabled={props.pending}
      onClick={props.onClick}
      className="le-btn-primary !min-h-[40px] w-full sm:w-auto"
    >
      {props.pending ? "儲存中…" : "儲存題目"}
    </button>
  );
}

export function PollBuilderPage({
  roomId,
  pollId,
  onLogout,
}: Props): React.JSX.Element {
  const queryClient = useQueryClient();
  const { showError, showSuccess, systemNoticeModal } = useSystemNotice();
  const { data: poll, isLoading, error } = useQuery({
    queryKey: ["poll", pollId],
    queryFn: () => getPoll(pollId),
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [options, setOptions] = useState<PollOptionInput[]>([]);
  const [minValue, setMinValue] = useState(1);
  const [maxValue, setMaxValue] = useState(5);
  const [minRaw, setMinRaw] = useState("1");
  const [maxRaw, setMaxRaw] = useState("5");
  const [maxSubmissions, setMaxSubmissions] = useState(3);
  const [maxSubmissionsRaw, setMaxSubmissionsRaw] = useState("3");
  const optionsHydratingRef = useRef(true);
  const lastAutosavedOptionsRef = useRef("");
  const initializedPollIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (error) showError(`載入失敗：${formatUserFacingError(error)}`);
  }, [error, showError]);

  useEffect(() => {
    if (!poll) return;
    // 只在第一次載入（pollId 切換）時初始化標題/說明，避免 autosave 引起的 refetch 覆蓋使用者輸入
    const isFirstLoad = initializedPollIdRef.current !== poll.id;
    if (isFirstLoad) {
      initializedPollIdRef.current = poll.id;
      setTitle(poll.title ?? "");
      setDescription(poll.description ?? "");
    }
    optionsHydratingRef.current = true;
    const loaded = poll.options.map((o) => ({
      text: o.text,
      is_correct: o.is_correct ?? false,
      order_no: o.order_no,
    }));
    setOptions(loaded);
    lastAutosavedOptionsRef.current = JSON.stringify(optionsPayload(loaded));
    if (poll.type === "rating") {
      const loadedMin = readNumber(poll.settings_public, "min_value", 1);
      const loadedMax = readNumber(poll.settings_public, "max_value", 5);
      setMinValue(loadedMin);
      setMaxValue(loadedMax);
      setMinRaw(String(loadedMin));
      setMaxRaw(String(loadedMax));
    }
    if (poll.type === "word_cloud") {
      const loaded = readNumber(poll.settings_public, "max_submissions", 3);
      setMaxSubmissions(loaded);
      setMaxSubmissionsRaw(String(loaded));
    }
    const t = window.setTimeout(() => {
      optionsHydratingRef.current = false;
    }, 0);
    return () => window.clearTimeout(t);
  }, [poll]);

  const saveMeta = useMutation({
    mutationFn: async () => {
      const payload: {
        title: string;
        description: string;
        settings?: Record<string, unknown>;
      } = { title, description };
      if (poll?.type === "rating") {
        payload.settings = {
          ...poll.settings_public,
          min_value: minValue,
          max_value: maxValue,
        };
      }
      if (poll?.type === "word_cloud") {
        payload.settings = {
          ...poll.settings_public,
          max_submissions: maxSubmissions,
        };
      }
      await updateInteraction(pollId, payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["poll", pollId] });
      showSuccess("題目資訊已儲存");
      window.location.hash = `#/rooms/${roomId}/workbench/${pollId}`;
    },
    onError: (err: unknown) => {
      showError(formatUserFacingError(err, "儲存失敗"));
    },
  });

  const persistOptions = useCallback(
    async (payload: PollOptionInput[], silent: boolean) => {
      await updatePollOptions(pollId, payload);
      lastAutosavedOptionsRef.current = JSON.stringify(payload);
      await queryClient.invalidateQueries({ queryKey: ["poll", pollId] });
      if (!silent) showSuccess("選項已儲存");
    },
    [pollId, queryClient, showSuccess]
  );

  const showOptions = Boolean(poll && OPTION_TYPES.has(poll.type));
  const showCorrectAnswer = Boolean(poll && CORRECT_ANSWER_TYPES.has(poll.type));
  const showRatingScale = poll?.type === "rating";
  const showWordCloudSettings = poll?.type === "word_cloud";

  useEffect(() => {
    if (!showOptions || optionsHydratingRef.current) return;

    const payload = optionsPayload(options);
    const signature = JSON.stringify(payload);
    if (signature === lastAutosavedOptionsRef.current) return;
    if (!canAutosaveOptions(options)) return;

    const timer = window.setTimeout(() => {
      void persistOptions(payload, true).catch((err: unknown) => {
        showError(formatUserFacingError(err, "選項自動儲存失敗"));
      });
    }, OPTIONS_AUTOSAVE_MS);

    return () => window.clearTimeout(timer);
  }, [options, showOptions, persistOptions, showError]);

  const handleSaveTitle = (): void => {
    if (showOptions && !hasFilledOption(options)) {
      showError("請至少提供一個選項");
      return;
    }
    if (showRatingScale) {
      if (minValue >= maxValue) {
        showError("最低分須小於最高分");
        return;
      }
      if (maxValue > 100) {
        showError("最高分不可超過 100");
        return;
      }
    }
    saveMeta.mutate();
  };

  const previewPoll = poll
    ? {
        ...poll,
        title: title || poll.title,
        description: description || poll.description,
        settings_public:
          poll.type === "rating"
            ? {
                ...poll.settings_public,
                min_value: minValue,
                max_value: maxValue,
              }
            : poll.settings_public,
        options: options.map((o, i) => ({
          id: `preview-${i}`,
          text: o.text,
          order_no: i,
          is_correct: o.is_correct ?? null,
        })),
      }
    : null;

  const pollTitle = poll?.title?.trim() || "未命名題目";

  return (
    <HostShell
      title="題目編輯"
      subtitle={poll ? interactionTypeLabel(poll.type) : ""}
      roomId={roomId}
      presentHref={presentAppUrl(roomId, pollId)}
      onLogout={onLogout}
      activeNav="polls"
      breadcrumb={
        <HostRoomDetailBreadcrumb
          roomId={roomId}
          sectionLabel="Poll 管理"
          sectionSegment="polls"
          segments={[
            {
              label: isLoading ? "載入中…" : pollTitle,
              href: `#/rooms/${roomId}/workbench/${pollId}`,
            },
            { label: "編輯" },
          ]}
        />
      }
      titleAddon={
        <HostTitleActions>
          <HostTitleLink href={`#/rooms/${roomId}/workbench/${pollId}`} variant="primary">
            本題工作台
          </HostTitleLink>
        </HostTitleActions>
      }
    >
      {isLoading || !poll ? (
        <p className="text-sm text-muted">載入中…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="le-card space-y-4 p-6">
            <SaveTitleButton pending={saveMeta.isPending} onClick={handleSaveTitle} />

            <label className="block text-sm">
              <span className="font-medium text-foreground">標題</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="le-input mt-1 w-full"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-foreground">說明</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="le-input mt-1 min-h-[72px] w-full resize-y"
              />
            </label>

            {showRatingScale ? (
              <div className="space-y-3 border-t border-border pt-4">
                <h3 className="text-sm font-semibold text-foreground">評分尺度</h3>
                <p className="text-xs text-muted">
                  最高 ≤5 顯示按鈕；6–10 顯示下拉選單；11 以上改為數字輸入。
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="font-medium text-foreground">最低分</span>
                    <input
                      type="number"
                      min={0}
                      max={99}
                      step={1}
                      value={minRaw}
                      onChange={(e) => {
                        setMinRaw(e.target.value);
                        const n = Number.parseInt(e.target.value, 10);
                        if (!Number.isNaN(n)) setMinValue(n);
                      }}
                      className="le-input mt-1 w-full"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="font-medium text-foreground">最高分</span>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      step={1}
                      value={maxRaw}
                      onChange={(e) => {
                        setMaxRaw(e.target.value);
                        const n = Number.parseInt(e.target.value, 10);
                        if (!Number.isNaN(n)) setMaxValue(n);
                      }}
                      className="le-input mt-1 w-full"
                    />
                  </label>
                </div>
              </div>
            ) : null}

            {showWordCloudSettings ? (
              <div className="space-y-3 border-t border-border pt-4">
                <h3 className="text-sm font-semibold text-foreground">文字雲設定</h3>
                <label className="block text-sm">
                  <span className="font-medium text-foreground">每人最多可提交幾組詞彙</span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    step={1}
                    value={maxSubmissionsRaw}
                    onChange={(e) => {
                      setMaxSubmissionsRaw(e.target.value);
                      const n = Number.parseInt(e.target.value, 10);
                      if (!Number.isNaN(n) && n >= 1 && n <= 10) setMaxSubmissions(n);
                    }}
                    className="le-input mt-1 w-full max-w-[8rem]"
                  />
                  <span className="mt-1 block text-xs text-muted">最少 1，最多 10</span>
                </label>
              </div>
            ) : null}

            {showOptions ? (
              <div className="space-y-3 border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">選項</h3>
                  <button
                    type="button"
                    onClick={() =>
                      setOptions((prev) => [
                        ...prev,
                        { text: `選項 ${prev.length + 1}`, is_correct: false },
                      ])
                    }
                    className="text-xs text-accent hover:underline"
                  >
                    + 新增
                  </button>
                </div>
                {options.length === 0 ? (
                  <p className="text-xs text-muted">尚無選項，請新增至少一項。</p>
                ) : null}
                {options.map((opt, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      value={opt.text}
                      onChange={(e) =>
                        setOptions((prev) => {
                          const next = [...prev];
                          next[idx] = { ...next[idx]!, text: e.target.value };
                          return next;
                        })
                      }
                      className="le-input flex-1 !min-h-[38px] text-sm"
                    />
                    {showCorrectAnswer ? (
                      <label className="flex shrink-0 items-center gap-1 text-xs text-muted">
                        <input
                          type="checkbox"
                          checked={Boolean(opt.is_correct)}
                          onChange={(e) =>
                            setOptions((prev) => {
                              const next = [...prev];
                              next[idx] = {
                                ...next[idx]!,
                                is_correct: e.target.checked,
                              };
                              return next;
                            })
                          }
                        />
                        正解
                      </label>
                    ) : null}
                    <button
                      type="button"
                      onClick={() =>
                        setOptions((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="shrink-0 text-xs text-danger hover:underline"
                    >
                      刪
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <SaveTitleButton pending={saveMeta.isPending} onClick={handleSaveTitle} />
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-foreground">預覽</h3>
            {previewPoll ? (
              <PollRenderer mode="preview" poll={previewPoll} />
            ) : null}
          </div>
        </div>
      )}
      {systemNoticeModal}
    </HostShell>
  );
}
