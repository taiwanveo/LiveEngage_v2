import * as React from "react";
import { MultipleChoicePoll } from "./polls/MultipleChoicePoll";
import { OpenTextPoll } from "./polls/OpenTextPoll";
import { RankingPoll } from "./polls/RankingPoll";
import { RatingPoll } from "./polls/RatingPoll";
import { WordCloudPoll } from "./polls/WordCloudPoll";
import type { PollRendererProps } from "./types";

export function PollRenderer(props: PollRendererProps): React.JSX.Element {
  switch (props.poll.type) {
    case "multiple_choice":
      return <MultipleChoicePoll {...props} />;
    case "word_cloud":
      return <WordCloudPoll {...props} />;
    case "open_text":
      return <OpenTextPoll {...props} />;
    case "rating":
      return <RatingPoll {...props} />;
    case "ranking":
      return <RankingPoll {...props} />;
    default: {
      const _exhaustive: never = props.poll.type;
      return (
        <p className="text-sm text-red-600">不支援的題型：{String(_exhaustive)}</p>
      );
    }
  }
}
