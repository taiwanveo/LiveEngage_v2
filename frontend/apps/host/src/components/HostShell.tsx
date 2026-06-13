import * as React from "react";

interface HostShellProps {
  title: string;
  subtitle?: string;
  roomId: string;
  onLogout: () => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export function HostShell({
  title,
  subtitle,
  roomId,
  onLogout,
  children,
  actions,
}: HostShellProps): React.JSX.Element {
  return (
    <main className="min-h-full bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
            {subtitle ? (
              <p className="text-xs text-slate-500">{subtitle}</p>
            ) : null}
            <p className="font-mono text-xs text-slate-400">room: {roomId}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {actions}
            <NavLink href={`#/rooms/${roomId}/moderation`}>Q&amp;A 審核</NavLink>
            <NavLink href={`#/rooms/${roomId}/polls`}>Poll 管理</NavLink>
            <button
              type="button"
              onClick={onLogout}
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              登出
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-6 py-6">{children}</div>
    </main>
  );
}

function NavLink(props: { href: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <a
      href={props.href}
      className="rounded-md bg-slate-100 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-200"
    >
      {props.children}
    </a>
  );
}
