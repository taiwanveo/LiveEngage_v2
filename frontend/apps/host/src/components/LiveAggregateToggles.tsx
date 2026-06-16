/** 即時聚合雙 Toggle（投影 / Join）。 */

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LIVE_AGGREGATE_JOIN,
  LIVE_AGGREGATE_SCREEN,
  readLiveAggregateSettings,
} from "@liveengage/renderers";
import { updateInteraction } from "../lib/interactionApi";
import type { InteractionSummary } from "../lib/pollTypes";
import { ControlToggle } from "./PollControlBar";

interface Props {
  roomId: string;
  item: InteractionSummary;
}

export function LiveAggregateToggles({ roomId, item }: Props): React.JSX.Element {
  const qc = useQueryClient();
  const { screen, join } = readLiveAggregateSettings(item.settings, item.type);

  const mutation = useMutation({
    mutationFn: (patch: Record<string, boolean>) =>
      updateInteraction(item.id, {
        settings: { ...item.settings, ...patch },
      }),
    onSuccess: (updated) => {
      qc.setQueryData<InteractionSummary[]>(
        ["interactions", roomId],
        (prev) => prev?.map((row) => (row.id === updated.id ? updated : row))
      );
      void qc.invalidateQueries({ queryKey: ["poll", item.id] });
    },
  });

  const pending = mutation.isPending;

  return (
    <>
      <ControlToggle
        active={screen}
        activeLabel="投影即時"
        inactiveLabel="投影即時"
        disabled={pending}
        accent={screen ? "success" : "default"}
        size="compact"
        onClick={() =>
          mutation.mutate({ [LIVE_AGGREGATE_SCREEN]: !screen })
        }
      />
      <ControlToggle
        active={join}
        activeLabel="Join 即時"
        inactiveLabel="Join 即時"
        disabled={pending}
        accent={join ? "success" : "default"}
        size="compact"
        onClick={() => mutation.mutate({ [LIVE_AGGREGATE_JOIN]: !join })}
      />
    </>
  );
}
