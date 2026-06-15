/** Poll 參與者預覽（工作台右欄）。 */

import * as React from "react";
import { PollRenderer, type PollDetail, type PollResults } from "@liveengage/renderers";
import { ParticipantPreviewFrame } from "@liveengage/ui";

interface Props {
  poll: PollDetail;
  results: PollResults | null;
}

export function WorkbenchPollPreview({ poll, results }: Props): React.JSX.Element {
  return (
    <ParticipantPreviewFrame
      stats={
        <p className="text-[10px] font-semibold tabular-nums leading-tight text-foreground">
          回應數{" "}
          <span className="font-display text-xs text-accent">
            {results?.response_count ?? 0}
          </span>
        </p>
      }
    >
      <PollRenderer
        mode="answer"
        poll={poll}
        results={poll.result_visible ? results : null}
        hostWorkbenchPreview
      />
    </ParticipantPreviewFrame>
  );
}
