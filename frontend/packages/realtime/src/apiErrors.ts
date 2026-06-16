/** 將 API／網路錯誤轉成使用者可讀的中文訊息。 */

const NETWORK_PATTERNS =
  /failed to fetch|load failed|networkerror|network request failed|fetch failed|aborted/i;

export function messageForHttpStatus(status: number): string {
  switch (status) {
    case 401:
      return "登入已過期，請重新登入";
    case 403:
      return "您沒有權限執行此操作";
    case 404:
      return "找不到要求的資源";
    case 409:
      return "目前狀態無法執行此操作";
    case 422:
      return "資料格式不正確，請檢查後再試";
    case 429:
      return "操作過於頻繁，請稍後再試";
    case 503:
      return "服務暫時無法使用，請稍後再試";
    default:
      if (status >= 500) return "伺服器發生錯誤，請稍後再試";
      if (status > 0) return `請求失敗（HTTP ${status}）`;
      return "無法連上伺服器，請確認網路連線或稍後再試";
  }
}

export function messageForFetchFailure(_err?: unknown): string {
  return "無法連上伺服器，請確認網路連線或稍後再試";
}

export function isNetworkFailure(err: unknown): boolean {
  return err instanceof Error && NETWORK_PATTERNS.test(err.message);
}

/** 登入失敗專用：401 統一為帳密錯誤提示，其餘沿用 formatUserFacingError。 */
export function formatLoginError(
  err: unknown,
  fallback = "登入失敗，請檢查帳號密碼"
): string {
  if (err && typeof err === "object" && "status" in err) {
    const status = (err as { status?: number }).status;
    if (status === 401) return "帳號或密碼錯誤";
    if (status === 429) return "登入嘗試過於頻繁，請稍後再試";
  }
  return formatUserFacingError(err, fallback);
}

/** 供 UI 顯示：優先後端 `error.message`，否則將英文網路錯誤轉中文。 */
export function formatUserFacingError(
  err: unknown,
  fallback = "操作失敗，請稍後再試"
): string {
  if (err && typeof err === "object" && "error" in err) {
    const apiErr = (err as { error?: { message?: string } }).error;
    if (apiErr?.message?.trim()) return apiErr.message.trim();
  }
  if (err instanceof Error) {
    if (NETWORK_PATTERNS.test(err.message)) return messageForFetchFailure(err);
    if (err.message.trim()) return err.message.trim();
  }
  return fallback;
}
