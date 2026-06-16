/** Standby：等待主持人切換投影內容。 */

import * as React from "react";

interface Props {
  sessionTitle: string | null;
  connected: boolean;
  updatedAt: string | null;
}

export function StandbyView({
  sessionTitle,
  connected,
  updatedAt,
}: Props): React.JSX.Element {
  const [size, setSize] = React.useState({ w: 0, h: 0 });

  React.useEffect(() => {
    const update = (): void =>
      setSize({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const updatedLabel = updatedAt
    ? new Date(updatedAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-950 px-8 text-center text-slate-100">
      <div className="w-full max-w-2xl rounded-2xl border border-emerald-500/30 bg-emerald-950/40 px-10 py-14 shadow-lg shadow-emerald-900/20">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-400/80">
          LiveEngage Screen
        </p>
        <h1 className="mt-4 font-display text-3xl font-bold text-emerald-100 md:text-4xl">
          {sessionTitle?.trim() || "即時互動活動"}
        </h1>
        <p className="mt-6 text-lg text-emerald-200/70">等待主持人切換投影內容…</p>
        <dl className="mt-10 grid gap-3 text-left text-sm text-slate-400 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">連線</dt>
            <dd className="mt-1 flex items-center gap-2 text-slate-200">
              <span
                className={`h-2.5 w-2.5 rounded-full ${connected ? "bg-emerald-400" : "bg-red-400"}`}
              />
              {connected ? "WebSocket 已連線" : "重新連線中…"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">解析度</dt>
            <dd className="mt-1 font-mono text-slate-200">
              {size.w}×{size.h}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-slate-500">最後更新</dt>
            <dd className="mt-1 text-slate-200">{updatedLabel}</dd>
          </div>
        </dl>
        <p className="mt-8 text-xs text-slate-500">按 F 進入全螢幕</p>
      </div>
    </div>
  );
}
