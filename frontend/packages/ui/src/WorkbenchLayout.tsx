/** 三欄 Session 工作台：25% 互動清單｜60% 控場｜15% Participant 預覽。 */

import * as React from "react";

export interface WorkbenchLayoutProps {
  toolbar: React.ReactNode;
  sidebar: React.ReactNode;
  main: React.ReactNode;
  preview: React.ReactNode;
}

export function WorkbenchLayout({
  toolbar,
  sidebar,
  main,
  preview,
}: WorkbenchLayoutProps): React.JSX.Element {
  return (
    <div className="le-page-bg flex min-h-full flex-col">
      {toolbar}
      <div className="relative z-10 grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[25%_60%_15%]">
        <aside className="min-h-0 border-b border-border bg-surface lg:border-b-0 lg:border-r">
          {sidebar}
        </aside>
        <section className="min-h-[320px] min-w-0 overflow-auto bg-background p-4 sm:p-5">
          {main}
        </section>
        <aside className="min-h-0 border-t border-border bg-surface lg:border-l lg:border-t-0">
          {preview}
        </aside>
      </div>
    </div>
  );
}
