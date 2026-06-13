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
  submitError,
  label = "提交",
}: SubmitFooterProps): React.JSX.Element {
  return (
    <div className="space-y-2">
      {submitError ? (
        <p className="text-sm text-red-600" role="alert">
          {submitError}
        </p>
      ) : null}
      <button
        type="button"
        onClick={onSubmit}
        disabled={disabled || submitting}
        className="w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "提交中…" : label}
      </button>
    </div>
  );
}
