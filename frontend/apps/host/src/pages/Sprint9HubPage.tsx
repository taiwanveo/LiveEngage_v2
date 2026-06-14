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
      <section className="le-card mb-8 p-6">
        <h2 className="mb-4 text-sm font-semibold text-foreground">建立互動</h2>
        <div className="flex flex-wrap gap-3">
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as typeof newType)}
            className="le-input !w-auto min-w-[180px]"
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
            className="le-input min-w-[200px] flex-1"
          />
          <button
            type="button"
            disabled={createMutation.isPending}
            onClick={() => createMutation.mutate()}
            className="le-btn-primary !min-h-[42px]"
          >
            建立
          </button>
        </div>
      </section>

      <section className="le-card overflow-hidden">
        <header className="border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold text-foreground">已建立項目</h2>
        </header>
        {isLoading ? (
          <p className="px-6 py-8 text-sm text-muted">載入中…</p>
        ) : s9Items.length === 0 ? (
          <p className="px-6 py-8 text-sm text-muted">尚無 Quiz / Ideas / Survey</p>
        ) : (
          <ul className="divide-y divide-border">
            {s9Items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
                <div>
                  <p className="font-medium text-foreground">
                    {item.title ?? item.type}
                    <span className="ml-2 text-xs text-muted">{item.type}</span>
                  </p>
                  <p className="text-xs text-muted">狀態：{item.status}</p>
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
                    className="le-btn-secondary !min-h-0 px-3 py-1.5 text-xs"
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
