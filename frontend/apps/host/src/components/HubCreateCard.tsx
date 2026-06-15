/** Poll／Quiz 管理頁「新增」區塊（高度與 Q&A 提問列一致）。 */

import * as React from "react";

export const HUB_CREATE_INPUT_CLASS =
  "le-input !h-[30px] !min-h-[30px] !py-0 !text-xs";

export const HUB_CREATE_BTN_CLASS =
  "le-btn-primary !min-h-[30px] !px-3 !py-1 !text-xs";

interface Props {
  title: string;
  children: React.ReactNode;
}

export function HubCreateCard({ title, children }: Props): React.JSX.Element {
  return (
    <section className="le-card mb-4 px-4 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="shrink-0 text-sm font-semibold leading-tight text-foreground">
          {title}
        </h2>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
          {children}
        </div>
      </div>
    </section>
  );
}
