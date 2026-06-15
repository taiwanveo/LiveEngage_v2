/** 登入表單：Enter 觸發 submit（等同按下登入按鈕）。 */

import * as React from "react";

export function onLoginFieldKeyDown(
  e: React.KeyboardEvent<HTMLInputElement>,
  loading: boolean
): void {
  if (e.key !== "Enter" || loading) return;
  const form = e.currentTarget.form;
  if (!form) return;
  e.preventDefault();
  form.requestSubmit();
}
