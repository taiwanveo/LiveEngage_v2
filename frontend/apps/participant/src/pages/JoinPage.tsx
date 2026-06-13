/** 依活動代碼加入（FE-001/002）：#/join/{code} */

import * as React from "react";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ApiException } from "../lib/api";
import {
  getParticipantContext,
  setParticipantSession,
} from "../lib/participantAuth";
import { joinSession, resolveSessionByCode } from "../lib/sessionApi";

interface Props {
  code: string;
}

export function JoinPage({ code }: Props): React.JSX.Element {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [passcode, setPasscode] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const sessionQuery = useQuery({
    queryKey: ["session-by-code", code],
    queryFn: () => resolveSessionByCode(code),
  });

  const session = sessionQuery.data;

  useEffect(() => {
    const ctx = getParticipantContext();
    if (ctx && session && ctx.sessionId === session.id) {
      window.location.hash = "#/room";
    }
  }, [session]);

  const joinMutation = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error("活動尚未載入");
      const payload: {
        passcode?: string;
        name?: string;
        email?: string;
        is_anonymous: boolean;
      } = { is_anonymous: isAnonymous };
      if (passcode.trim()) payload.passcode = passcode.trim();
      if (name.trim()) payload.name = name.trim();
      if (email.trim()) payload.email = email.trim();
      return joinSession(session.id, payload);
    },
    onSuccess: (res) => {
      if (!res.room_id) {
        setFormError("加入成功但缺少房間資訊");
        return;
      }
      setParticipantSession({
        participantToken: res.participant_token,
        sessionId: res.session_id,
        roomId: res.room_id,
        sessionCode: code,
        displayName: res.display_name,
      });
      window.location.hash = "#/room";
    },
    onError: (err: unknown) => {
      if (err instanceof ApiException) {
        setFormError(err.error.message);
      } else {
        setFormError((err as Error).message);
      }
    },
  });

  if (sessionQuery.isLoading) {
    return <CenteredMessage>正在查詢活動代碼…</CenteredMessage>;
  }

  if (sessionQuery.error) {
    const msg =
      sessionQuery.error instanceof ApiException
        ? sessionQuery.error.error.message
        : (sessionQuery.error as Error).message;
    return (
      <CenteredMessage>
        <p className="text-red-600">{msg}</p>
        <a href="#/join" className="mt-4 inline-block text-sm text-primary-600 hover:underline">
          重新輸入代碼
        </a>
      </CenteredMessage>
    );
  }

  if (!session) {
    return <CenteredMessage>找不到活動</CenteredMessage>;
  }

  const needsPasscode = session.visibility === "passcode";
  const notLive = session.status !== "live";

  return (
    <main className="flex min-h-full items-center justify-center bg-slate-100 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
        <p className="font-mono text-xs text-slate-400">{session.code}</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">{session.title}</h1>
        <p className="mt-2 text-sm text-slate-600">
          狀態：{statusLabel(session.status)}
        </p>

        {notLive ? (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            活動尚未開始，請等待主持人開放後再試。
          </div>
        ) : (
          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setFormError(null);
              joinMutation.mutate();
            }}
          >
            {needsPasscode ? (
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Passcode</span>
                <input
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  required
                />
              </label>
            ) : null}

            {session.require_name ? (
              <label className="block text-sm">
                <span className="font-medium text-slate-700">姓名</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  required
                />
              </label>
            ) : (
              <label className="block text-sm">
                <span className="font-medium text-slate-700">暱稱（選填）</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
            )}

            {session.require_email ? (
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  required
                />
              </label>
            ) : null}

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              匿名參與
            </label>

            {formError ? (
              <p className="text-sm text-red-600" role="alert">
                {formError}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={joinMutation.isPending}
              className="w-full rounded-lg bg-primary-600 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {joinMutation.isPending ? "加入中…" : "加入活動"}
            </button>
          </form>
        )}

        <a
          href="#/join"
          className="mt-6 block text-center text-sm text-slate-500 hover:text-slate-800"
        >
          使用其他代碼
        </a>
      </div>
    </main>
  );
}

function statusLabel(status: string): string {
  switch (status) {
    case "live":
      return "進行中";
    case "draft":
      return "草稿";
    case "ended":
      return "已結束";
    case "archived":
      return "已封存";
    default:
      return status;
  }
}

function CenteredMessage(props: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <main className="flex min-h-full items-center justify-center bg-slate-100 px-4">
      <div className="text-center text-slate-600">{props.children}</div>
    </main>
  );
}
