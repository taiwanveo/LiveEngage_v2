/** 登入表單：Enter 觸發 submit、欄位驗證。 */

import * as React from "react";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Host/Admin Email + 密碼登入欄位驗證；通過回傳 null。 */
export function validateEmailPasswordLogin(
  email: string,
  password: string
): string | null {
  const trimmedEmail = email.trim();
  if (!trimmedEmail) return "請輸入 Email";
  if (!EMAIL_PATTERN.test(trimmedEmail)) return "Email 格式不正確";
  if (!password) return "請輸入密碼";
  if (password.length < 8) return "密碼至少需要 8 個字元";
  return null;
}

export const LOGIN_ERROR_BANNER_CLASS =
  "rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm leading-relaxed text-danger";

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
