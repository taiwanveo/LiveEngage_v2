/** Poll Builder（BE-003）：編輯題目、選項、預覽。 */

import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PollRenderer } from "@liveengage/renderers";
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
  const optionsHydratingRef = useRef(true);
  const lastAutosavedOptionsRef = useRef("");

  useEffect(() => {
    if (error) showError((error as Error).message);
  }, [error, showError]);

  useEffect(() => {
    if (!poll) return;
    optionsHydratingRef.current = true;
    setTitle(poll.title ?? "");
    setDescription(poll.description ?? "");
    const loaded = poll.options.map((o) => ({
      text: o.text,
      is_correct: o.is_correct ?? false,
      order_no: o.order_no,
    }));
    setOptions(loaded);
    lastAutosavedOptionsRef.current = JSON.stringify(optionsPayload(loaded));
    const t = window.setTimeout(() => {
      optionsHydratingRef.current = false;
    }, 0);
    return () => window.clearTimeout(t);
  }, [poll]);

  const saveMeta = useMutation({
    mutationFn: async () => {
      await updateInteraction(pollId, { title, description });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["poll", pollId] });
      showSuccess("題目資訊已儲存");
    },
    onError: (err: unknown) => {
      showError(err instanceof Error ? err.message : "儲存失敗");
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

  useEffect(() => {
    if (!showOptions || optionsHydratingRef.current) return;

    const payload = optionsPayload(options);
    const signature = JSON.stringify(payload);
    if (signature === lastAutosavedOptionsRef.current) return;
    if (!canAutosaveOptions(options)) return;

    const timer = window.setTimeout(() => {
      void persistOptions(payload, true).catch((err: unknown) => {
        showError(err instanceof Error ? err.message : "選項自動儲存失敗");
      });
    }, OPTIONS_AUTOSAVE_MS);

    return () => window.clearTimeout(timer);
  }, [options, showOptions, persistOptions, showError]);

  const handleSaveTitle = (): void => {
    if (showOptions && !hasFilledOption(options)) {
      showError("請至少提供一個選項");
      return;
    }
    saveMeta.mutate();
  };

  const previewPoll = poll
    ? {
        ...poll,
        title: title || poll.title,
        description: description || poll.description,
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
      title="投票編輯"
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
              href: `#/rooms/${roomId}/polls/${pollId}/console`,
            },
            { label: "編輯" },
          ]}
        />
      }
      titleAddon={
        <HostTitleActions>
          <HostTitleLink
            href={`#/rooms/${roomId}/workbench/${pollId}`}
            variant="secondary"
          >
            回到工作台
          </HostTitleLink>
          <HostTitleLink href={`#/rooms/${roomId}/polls/${pollId}/console`} variant="primary">
            前往控制台
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
