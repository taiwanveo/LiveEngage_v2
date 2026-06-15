/** 參與者會場：互動尚未開始時的等待提示。 */

import * as React from "react";

interface Props {
  message: string;
}

export function RoomWaitingPlaceholder({ message }: Props): React.JSX.Element {
  return (
    <div className="le-card border-dashed p-10 text-center">
      <p className="text-lg font-medium text-foreground">{message}</p>
    </div>
  );
}

export const ROOM_INTERACTION_WAIT_MESSAGE =
  "目前互動尚未開始，請等候活動主持人啟動互動項目";

export const ROOM_QA_WAIT_MESSAGE =
  "目前尚未開放發問，請等候活動主持人啟動Q&A";
