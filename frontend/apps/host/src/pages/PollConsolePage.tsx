/** 舊 Poll console 路由 → 統一工作台。 */

import * as React from "react";
import { WorkbenchRedirect } from "../components/WorkbenchRedirect";

interface Props {
  roomId: string;
  pollId: string;
  onLogout: () => void;
}

export function PollConsolePage({ roomId, pollId }: Props): React.JSX.Element {
  return <WorkbenchRedirect roomId={roomId} interactionId={pollId} />;
}
