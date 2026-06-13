/** 三欄 Session 工作台（Slido 風格）。 */

import * as React from "react";

export interface WorkbenchLayoutProps {
  toolbar: React.ReactNode;
  sidebar: React.ReactNode;
  main: React.ReactNode;
  preview: React.ReactNode;
  footer?: React.ReactNode;
}

export function WorkbenchLayout({
  toolbar,
  sidebar,
  main,
  preview,
  footer,
}: WorkbenchLayoutProps): React.JSX.Element {
  return (
    <div className="le-page-bg flex min-h-full flex-col">
      {toolbar}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="w-full shrink-0 border-b border-border bg-surface lg:w-72 lg:border-b-0 lg:border-r xl:w-80">
          {sidebar}
        </aside>
        <section className="min-h-[320px] min-w-0 flex-1 overflow-auto bg-background p-4 sm:p-5">
          {main}
        </section>
        <aside className="w-full shrink-0 border-t border-border bg-surface lg:w-80 lg:border-l lg:border-t-0 xl:w-96">
          {preview}
        </aside>
      </div>
      {footer ? (
        <footer className="border-t border-border bg-surface px-4 py-2.5 sm:px-5">{footer}</footer>
      ) : null}
    </div>
  );
}
