/** 活動加入分享：連結、代碼、QR（QR 由第三方圖片 API 產生，僅供現場掃描）。 */

import * as React from "react";
import { useState } from "react";

interface Props {
  code: string;
  joinUrl: string;
}

export function JoinShareCard({ code, joinUrl }: Props): React.JSX.Element {
  const [copied, setCopied] = useState<"link" | "code" | null>(null);
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(joinUrl)}`;

  async function copy(text: string, kind: "link" | "code"): Promise<void> {
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="mt-4 flex flex-wrap items-start gap-6 border-t border-border pt-4">
      <div className="flex flex-col items-center gap-2">
        <img
          src={qrSrc}
          width={160}
          height={160}
          alt={`活動 ${code} 參與 QR code`}
          className="le-surface-light rounded-lg border border-border"
          loading="lazy"
        />
        <p className="text-xs text-muted">掃描加入（QR）</p>
      </div>

      <div className="min-w-[200px] flex-1 space-y-3">
        <div>
          <p className="text-xs font-medium text-muted">活動代碼</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="font-mono text-2xl font-bold tracking-wider text-accent">
              {code}
            </span>
            <button
              type="button"
              onClick={() => void copy(code, "code")}
              className="le-btn-secondary !min-h-0 px-2 py-1 text-xs"
            >
              {copied === "code" ? "已複製" : "複製代碼"}
            </button>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-muted">參與連結</p>
          <p className="mt-1 break-all text-xs text-muted">{joinUrl}</p>
          <button
            type="button"
            onClick={() => void copy(joinUrl, "link")}
            className="mt-2 rounded-md bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700"
          >
            {copied === "link" ? "已複製連結" : "複製參與連結"}
          </button>
        </div>
      </div>
    </div>
  );
}
