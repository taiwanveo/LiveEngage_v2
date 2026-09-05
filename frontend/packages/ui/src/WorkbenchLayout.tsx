/** 三欄 Session 工作台：互動清單（約 17%）｜控場（55%）｜Participant 預覽（約 28%）。 */

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
    <div
      className="le-page-bg flex min-h-full flex-col overflow-x-clip"
      style={{ "--workbench-header-offset": "136px" } as React.CSSProperties}
    >
      {toolbar}
      {/* 左欄為原 25% 的 2/3；釋出寬度全給右側預覽欄 */}
      <div className="relative grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[50fr_165fr_85fr]">
        <aside className="flex min-h-0 flex-col border-b border-border bg-surface lg:sticky lg:top-[var(--workbench-header-offset,136px)] lg:self-start lg:max-h-[calc(100vh-var(--workbench-header-offset,136px))] lg:border-b-0 lg:border-r">
          {sidebar}
        </aside>
        <section className="min-h-[320px] min-w-0 bg-background p-4 sm:p-5 lg:overflow-visible">
          {main}
        </section>
        <aside className="flex min-h-0 flex-col border-t border-border bg-surface lg:sticky lg:top-[var(--workbench-header-offset,136px)] lg:self-start lg:max-h-[calc(100vh-var(--workbench-header-offset,136px)-1.5rem)] lg:overflow-y-auto lg:border-l lg:border-t-0">
          {preview}
        </aside>
      </div>
    </div>
  );
}
