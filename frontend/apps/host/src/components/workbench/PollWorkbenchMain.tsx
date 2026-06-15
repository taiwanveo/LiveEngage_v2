/** Poll 工作台中欄：標題、編輯、投影預覽。 */

import * as React from "react";
import { PollRenderer, type PollDetail, type PollResults } from "@liveengage/renderers";
import {
  interactionStatusLabel,
  pollTypeLabel,
} from "../../lib/pollTypes";

interface Props {
  roomId: string;
  poll: PollDetail;
  results: PollResults | null;
}

export function PollWorkbenchMain({ roomId, poll, results }: Props): React.JSX.Element {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-muted">{pollTypeLabel(poll.type)}</p>
          <h2 className="font-display text-xl font-semibold text-foreground">
            {poll.title ?? "未命名題目"}
          </h2>
          <p className="mt-1 text-sm text-muted">
            狀態：{interactionStatusLabel(poll.status)}
            {poll.result_visible ? " · 結果已揭示" : ""}
          </p>
        </div>
        <a
          href={`#/rooms/${roomId}/polls/${poll.id}/builder`}
          className="le-btn-secondary !min-h-[36px] !text-xs"
        >
          編輯題目
        </a>
      </div>
      <div className="le-card overflow-hidden p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">投影預覽</h3>
        <PollRenderer mode="present" poll={poll} results={results} />
      </div>
    </>
  );
}
