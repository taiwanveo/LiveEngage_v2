/** Poll Builder（BE-003）：編輯題目、選項、預覽。 */

import * as React from "react";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PollRenderer } from "@liveengage/renderers";
import { HostShell } from "../components/HostShell";
import { updateInteraction } from "../lib/interactionApi";
import { getPoll, updatePollOptions } from "../lib/pollApi";
import type { PollOptionInput } from "../lib/pollTypes";

interface Props {
  roomId: string;
  pollId: string;
  onLogout: () => void;
}

const OPTION_TYPES = new Set(["multiple_choice", "ranking"]);

export function PollBuilderPage({
  roomId,
  pollId,
  onLogout,
}: Props): React.JSX.Element {
  const queryClient = useQueryClient();
  const { data: poll, isLoading, error } = useQuery({
    queryKey: ["poll", pollId],
    queryFn: () => getPoll(pollId),
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [options, setOptions] = useState<PollOptionInput[]>([]);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!poll) return;
    setTitle(poll.title ?? "");
    setDescription(poll.description ?? "");
    setOptions(
      poll.options.map((o) => ({
        text: o.text,
        is_correct: o.is_correct ?? false,
        order_no: o.order_no,
      }))
    );
  }, [poll]);

  const saveMeta = useMutation({
    mutationFn: async () => {
      await updateInteraction(pollId, { title, description });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["poll", pollId] });
      setSaveMsg("題目資訊已儲存");
    },
  });

  const saveOptions = useMutation({
    mutationFn: async () => {
      await updatePollOptions(
        pollId,
        options.map((o, i) => ({ ...o, order_no: i }))
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["poll", pollId] });
      setSaveMsg("選項已儲存");
    },
  });

  const showOptions = poll && OPTION_TYPES.has(poll.type);

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

  return (
    <HostShell
      title="Poll Builder"
      subtitle={poll?.type ?? ""}
      roomId={roomId}
      onLogout={onLogout}
      activeNav="polls"
      actions={
        <a
          href={`#/rooms/${roomId}/polls/${pollId}/console`}
          className="rounded-md bg-primary-600 px-3 py-1.5 text-sm text-white hover:bg-primary-700"
        >
          前往控制台
        </a>
      }
    >
      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {(error as Error).message}
        </div>
      ) : null}
      {saveMsg ? (
        <p className="mb-4 text-sm text-emerald-700">{saveMsg}</p>
      ) : null}

      {isLoading || !poll ? (
        <p className="text-sm text-slate-500">載入中…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <label className="block text-sm">
              <span className="font-medium text-slate-700">標題</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">說明</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
            <button
              type="button"
              disabled={saveMeta.isPending}
              onClick={() => saveMeta.mutate()}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700 disabled:opacity-50"
            >
              儲存題目
            </button>

            {showOptions ? (
              <div className="space-y-3 border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">選項</h3>
                  <button
                    type="button"
                    onClick={() =>
                      setOptions((prev) => [
                        ...prev,
                        { text: `選項 ${prev.length + 1}`, is_correct: false },
                      ])
                    }
                    className="text-xs text-primary-600 hover:underline"
                  >
                    + 新增
                  </button>
                </div>
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
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <label className="flex items-center gap-1 text-xs text-slate-600">
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
                      className="text-xs text-red-600"
                    >
                      刪
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  disabled={saveOptions.isPending || options.length === 0}
                  onClick={() => saveOptions.mutate()}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  儲存選項
                </button>
              </div>
            ) : null}
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-700">預覽</h3>
            {previewPoll ? (
              <PollRenderer mode="preview" poll={previewPoll} />
            ) : null}
          </div>
        </div>
      )}
    </HostShell>
  );
}
