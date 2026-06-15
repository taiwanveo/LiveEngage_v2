/** Poll 工作台中欄：標題、編輯、刪除、投影預覽。 */

import * as React from "react";
import { PollRenderer, type PollDetail, type PollResults } from "@liveengage/renderers";
import { pollTypeLabel } from "../../lib/pollTypes";
import { WorkbenchInteractionStatusBadge } from "./WorkbenchInteractionStatusBadge";
import { WorkbenchInteractionTitle } from "./WorkbenchInteractionTitle";

interface Props {
  roomId: string;
  poll: PollDetail;
  results: PollResults | null;
}

export function PollWorkbenchMain({
  roomId,
  poll,
  results,
}: Props): React.JSX.Element {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted">{pollTypeLabel(poll.type)}</p>
          <WorkbenchInteractionTitle
            roomId={roomId}
            interactionId={poll.id}
            title={poll.title}
            placeholder="未命名題目"
          />
          {poll.result_visible ? (
            <p className="mt-1 text-xs text-muted">結果已揭示</p>
          ) : null}
        </div>
        <WorkbenchInteractionStatusBadge status={poll.status} />
      </div>
      <div className="le-card overflow-hidden p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">投影預覽</h3>
        <PollRenderer mode="present" poll={poll} results={results} />
      </div>
    </>
  );
}
