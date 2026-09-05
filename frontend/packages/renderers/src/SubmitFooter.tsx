import * as React from "react";

interface SubmitFooterProps {
  onSubmit: () => void;
  submitting: boolean;
  disabled: boolean;
  submitError: string | null | undefined;
  label?: string;
}

export function SubmitFooter({
  onSubmit,
  submitting,
  disabled,
  submitError: _submitError,
  label = "提交",
}: SubmitFooterProps): React.JSX.Element {
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onSubmit}
        disabled={disabled || submitting}
        className="le-btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "提交中…" : label}
      </button>
    </div>
  );
}
