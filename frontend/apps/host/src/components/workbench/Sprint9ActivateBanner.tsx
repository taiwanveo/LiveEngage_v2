/** Sprint9 互動尚未開放時的提示與開放按鈕。 */

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { formatUserFacingError } from "@liveengage/realtime";
import { useSystemNotice } from "@liveengage/ui";
import { updateInteractionStatus } from "../../lib/interactionApi";
import { interactionTypeLabel, type InteractionSummary } from "../../lib/pollTypes";

interface Props {
  roomId: string;
  item: InteractionSummary;
}

export function Sprint9ActivateBanner({ roomId, item }: Props): React.JSX.Element | null {
  const qc = useQueryClient();
  const { showError, showSuccess } = useSystemNotice();

  const activateMutation = useMutation({
    mutationFn: () => updateInteractionStatus(item.id, "active"),
    onSuccess: () => {
      showSuccess("已開放");
      void qc.invalidateQueries({ queryKey: ["interactions", roomId] });
    },
    onError: (err: unknown) => {
      showError(formatUserFacingError(err, "開放失敗"));
    },
  });

  if (item.status === "active" || item.status === "locked") return null;

  return (
    <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
      此{interactionTypeLabel(item.type)}尚未開放，參與者無法作答。
      <button
        type="button"
        disabled={activateMutation.isPending}
        onClick={() => activateMutation.mutate()}
        className="ml-2 font-medium text-accent underline disabled:opacity-50"
      >
        {activateMutation.isPending ? "開放中…" : "立即開放"}
      </button>
    </p>
  );
}
