/** 舊 Sprint9 console 路由 → 統一工作台。 */

import * as React from "react";
import { WorkbenchRedirect } from "../components/WorkbenchRedirect";

interface Props {
  roomId: string;
  interactionId: string;
  onLogout: () => void;
}

export function Sprint9ConsolePage({
  roomId,
  interactionId,
}: Props): React.JSX.Element {
  return <WorkbenchRedirect roomId={roomId} interactionId={interactionId} />;
}
