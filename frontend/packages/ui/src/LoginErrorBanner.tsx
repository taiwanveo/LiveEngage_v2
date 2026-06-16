/** 登入表單內嵌錯誤提示（比 Modal 更顯眼、不易被忽略）。 */

import * as React from "react";
import { LOGIN_ERROR_BANNER_CLASS } from "./loginForm";

export function LoginErrorBanner({
  message,
}: {
  message: string | null;
}): React.JSX.Element | null {
  if (!message) return null;
  return (
    <div role="alert" aria-live="polite" className={LOGIN_ERROR_BANNER_CLASS}>
      {message}
    </div>
  );
}
