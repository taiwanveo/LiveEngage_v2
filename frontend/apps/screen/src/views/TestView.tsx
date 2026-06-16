/** 測試畫面：場控確認投影通道。 */

import * as React from "react";

export function TestView(): React.JSX.Element {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-slate-950">
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(45deg, #1e293b 25%, transparent 25%), linear-gradient(-45deg, #1e293b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1e293b 75%), linear-gradient(-45deg, transparent 75%, #1e293b 75%)",
          backgroundSize: "40px 40px",
          backgroundPosition: "0 0, 0 20px, 20px -20px, -20px 0",
        }}
      />
      <div className="relative z-10 text-center">
        <p className="font-mono text-6xl font-bold tracking-tight text-white md:text-8xl">
          TEST
        </p>
        <p className="mt-4 text-xl text-slate-400">投影測試畫面 · LiveEngage Screen</p>
      </div>
    </div>
  );
}
