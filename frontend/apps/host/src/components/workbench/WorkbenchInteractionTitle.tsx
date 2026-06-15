/** 工作台中欄標題：雙擊編輯，失焦自動儲存。 */

import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { formatUserFacingError } from "@liveengage/realtime";
import { useSystemNotice } from "@liveengage/ui";
import { canEditHostContent } from "../../lib/auth";
import { updateInteraction } from "../../lib/interactionApi";
import type { InteractionSummary } from "../../lib/pollTypes";

interface Props {
  roomId: string;
  interactionId: string;
  title: string | null;
  placeholder?: string;
}

const TITLE_CLASS =
  "font-display w-full text-xl font-semibold text-foreground bg-transparent outline-none";

export function WorkbenchInteractionTitle({
  roomId,
  interactionId,
  title,
  placeholder = "未命名",
}: Props): React.JSX.Element {
  const qc = useQueryClient();
  const { showError } = useSystemNotice();
  const editable = canEditHostContent();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const ignoreBlurUntil = useRef(0);

  const displayTitle = title?.trim() ? title.trim() : placeholder;

  useEffect(() => {
    if (!editing) return;
    setDraft(title?.trim() ?? "");
    ignoreBlurUntil.current = Date.now() + 150;
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [editing, title]);

  const saveMutation = useMutation({
    mutationFn: (nextTitle: string) =>
      updateInteraction(interactionId, {
        title: nextTitle.trim() ? nextTitle.trim() : null,
      }),
    onMutate: async (nextTitle) => {
      await qc.cancelQueries({ queryKey: ["interactions", roomId] });
      const normalized = nextTitle.trim() || null;
      const previous = qc.getQueryData<InteractionSummary[]>(["interactions", roomId]);
      if (previous) {
        qc.setQueryData(
          ["interactions", roomId],
          previous.map((item) =>
            item.id === interactionId ? { ...item, title: normalized } : item
          )
        );
      }
      qc.setQueryData<InteractionSummary>(["poll", interactionId], (old) =>
        old ? { ...old, title: normalized } : old
      );
      return { previous };
    },
    onError: (err: unknown, _title, context) => {
      if (context?.previous) {
        qc.setQueryData(["interactions", roomId], context.previous);
      }
      showError(formatUserFacingError(err, "名稱儲存失敗"));
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["interactions", roomId] });
      void qc.invalidateQueries({ queryKey: ["poll", interactionId] });
    },
  });

  const commit = () => {
    if (saveMutation.isPending) return;
    const trimmed = draft.trim();
    const current = title?.trim() ?? "";
    if (trimmed === current) {
      setEditing(false);
      return;
    }
    saveMutation.mutate(trimmed, {
      onSuccess: () => setEditing(false),
    });
  };

  const handleBlur = () => {
    if (Date.now() < ignoreBlurUntil.current) return;
    commit();
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        maxLength={500}
        disabled={saveMutation.isPending}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void inputRef.current?.blur();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            setEditing(false);
          }
        }}
        className={`${TITLE_CLASS} rounded border border-accent px-1 py-0.5`}
        aria-label="互動項目名稱"
      />
    );
  }

  return (
    <h2
      className={`${TITLE_CLASS} ${editable ? "cursor-text rounded px-1 -mx-1 hover:bg-surface-elevated/80" : ""}`}
      onDoubleClick={() => {
        if (!editable) return;
        setEditing(true);
      }}
      title={editable ? "雙擊編輯名稱" : undefined}
    >
      {displayTitle}
    </h2>
  );
}
