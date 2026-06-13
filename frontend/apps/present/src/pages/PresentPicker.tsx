import * as React from "react";
import { clearAccessToken } from "../lib/auth";

interface Props {
  onLogout: () => void;
}

export function PresentPicker({ onLogout }: Props): React.JSX.Element {
  return (
    <main className="flex min-h-full items-center justify-center bg-slate-950 px-4">
      <div className="max-w-lg space-y-4 rounded-2xl border border-white/10 bg-slate-900 p-8 text-center">
        <h2 className="text-xl font-semibold text-white">請開啟投影網址</h2>
        <p className="text-sm text-slate-400">
          從 Host 控制台複製投影連結，或在網址列輸入：
        </p>
        <code className="block rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-300">
          #/rooms/&lt;roomId&gt;/polls/&lt;pollId&gt;/present
        </code>
        <p className="text-xs text-slate-500">
          本端開發：<code className="text-slate-400">http://localhost:5175</code>
        </p>
        <button
          type="button"
          onClick={() => {
            clearAccessToken();
            onLogout();
          }}
          className="text-sm text-slate-500 hover:text-slate-300"
        >
          登出（sign out）
        </button>
      </div>
    </main>
  );
}
