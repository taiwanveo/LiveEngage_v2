/** Sprint 9 互動管理：Quiz / Ideas / Survey 建立與進入控制台。 */

import * as React from "react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HostShell } from "../components/HostShell";
import {
  createInteraction,
  listInteractions,
  updateInteractionStatus,
} from "../lib/interactionApi";

interface Props {
  roomId: string;
  onLogout: () => void;
}

const S9_TYPES = [
  { value: "quiz" as const, label: "Quiz 快問快答" },
  { value: "ideas" as const, label: "Ideas 點子牆" },
  { value: "survey" as const, label: "Survey 問卷" },
];

export function Sprint9HubPage({ roomId, onLogout }: Props): React.JSX.Element {
  const qc = useQueryClient();
  const [newType, setNewType] = useState<(typeof S9_TYPES)[number]["value"]>("quiz");
  const [title, setTitle] = useState("");

  const { data: items, isLoading } = useQuery({
    queryKey: ["interactions", roomId],
    queryFn: () => listInteractions(roomId),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createInteraction(roomId, {
        type: newType,
        ...(title.trim() ? { title: title.trim() } : {}),
      }),
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: ["interactions", roomId] });
      window.location.hash = `#/rooms/${roomId}/sprint9/${created.id}/console`;
    },
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => updateInteractionStatus(id, "active"),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["interactions", roomId] }),
  });

  const s9Items = (items ?? []).filter((i) =>
    ["quiz", "ideas", "survey"].includes(i.type)
  );

  return (
    <HostShell title="Quiz / Ideas / Survey" roomId={roomId} onLogout={onLogout}>
      <section className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">建立互動</h2>
        <div className="flex flex-wrap gap-3">
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as typeof newType)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {S9_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="標題（選填）"
            className="min-w-[200px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={createMutation.isPending}
            onClick={() => createMutation.mutate()}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            建立
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">已建立項目</h2>
        {isLoading ? (
          <p className="text-sm text-slate-500">載入中…</p>
        ) : s9Items.length === 0 ? (
          <p className="text-sm text-slate-500">尚無 Quiz / Ideas / Survey</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {s9Items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium text-slate-900">
                    {item.title ?? item.type}
                    <span className="ml-2 text-xs text-slate-500">{item.type}</span>
                  </p>
                  <p className="text-xs text-slate-400">狀態：{item.status}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.status !== "active" ? (
                    <button
                      type="button"
                      onClick={() => activateMutation.mutate(item.id)}
                      className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-700"
                    >
                      開放
                    </button>
                  ) : null}
                  <a
                    href={`#/rooms/${roomId}/sprint9/${item.id}/console`}
                    className="rounded-md bg-slate-900 px-3 py-1.5 text-xs text-white hover:bg-slate-800"
                  >
                    控制台
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </HostShell>
  );
}
