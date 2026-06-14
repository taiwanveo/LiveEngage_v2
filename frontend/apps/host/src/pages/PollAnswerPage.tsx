/** 參與者作答預覽（需 participant token 才能真正提交）。 */

import * as React from "react";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { PollRenderer } from "@liveengage/renderers";
import { useSystemNotice } from "@liveengage/ui";
import { HostShell } from "../components/HostShell";
import { getPoll, getPollResults, submitPollResponse } from "../lib/pollApi";

interface Props {
  roomId: string;
  pollId: string;
  onLogout: () => void;
}

export function PollAnswerPage({
  roomId,
  pollId,
  onLogout,
}: Props): React.JSX.Element {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { showError, systemNoticeModal } = useSystemNotice();

  const pollQuery = useQuery({
    queryKey: ["poll", pollId],
    queryFn: () => getPoll(pollId),
    refetchInterval: 3_000,
  });

  const resultsQuery = useQuery({
    queryKey: ["poll-results", pollId],
    queryFn: () => getPollResults(pollId),
    enabled: Boolean(pollQuery.data?.result_visible),
    refetchInterval: 2_500,
  });

  const submitMutation = useMutation({
    mutationFn: (answer: Record<string, unknown>) =>
      submitPollResponse(pollId, answer),
    onSuccess: () => {
      setSubmitError(null);
      void pollQuery.refetch();
    },
    onError: (e: Error) => setSubmitError(e.message),
  });

  const poll = pollQuery.data;

  useEffect(() => {
    if (pollQuery.error) showError((pollQuery.error as Error).message);
  }, [pollQuery.error, showError]);

  useEffect(() => {
    if (submitError) showError(submitError);
  }, [submitError, showError]);

  return (
    <HostShell
      title="參與者作答預覽"
      subtitle="Host token 僅供預覽；實際提交需 participant token"
      roomId={roomId}
      presentPollId={pollId}
      onLogout={onLogout}
      activeNav="polls"
    >
      {poll ? (
        <div className="max-w-xl">
          <PollRenderer
            mode="answer"
            poll={poll}
            results={poll.result_visible ? resultsQuery.data ?? null : null}
            onSubmit={(answer) => submitMutation.mutate(answer)}
            submitting={submitMutation.isPending}
            submitError={submitError}
          />
        </div>
      ) : (
        <p className="text-sm text-slate-500">載入中…</p>
      )}
      {systemNoticeModal}
    </HostShell>
  );
}
