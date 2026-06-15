/** 將舊 console 路由導向統一工作台。 */

import * as React from "react";
import { useEffect } from "react";

interface Props {
  roomId: string;
  interactionId: string;
}

export function WorkbenchRedirect({ roomId, interactionId }: Props): React.JSX.Element {
  useEffect(() => {
    window.location.replace(`#/rooms/${roomId}/workbench/${interactionId}`);
  }, [roomId, interactionId]);

  return (
    <div className="flex min-h-full items-center justify-center p-8 text-sm text-muted">
      導向工作台…
    </div>
  );
}
