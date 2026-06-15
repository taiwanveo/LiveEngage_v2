/** 設計系統按鈕：全專案統一 variant／size。 */

import * as React from "react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "success"
  | "muted";

export type ButtonSize = "md" | "sm" | "xs";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "le-btn-primary",
  secondary: "le-btn-secondary",
  ghost: "le-btn-ghost",
  danger: "le-btn-danger",
  success: "le-btn-success",
  muted: "le-btn-muted",
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  md: "",
  sm: "le-btn-sm",
  xs: "le-btn-xs",
};

function joinClasses(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

export function Button({
  variant = "secondary",
  size = "md",
  className,
  type = "button",
  children,
  ...rest
}: ButtonProps): React.JSX.Element {
  return (
    <button
      type={type}
      className={joinClasses(VARIANT_CLASS[variant], SIZE_CLASS[size], className)}
      {...rest}
    >
      {children}
    </button>
  );
}

export interface ButtonLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

export function ButtonLink({
  variant = "secondary",
  size = "md",
  className,
  children,
  ...rest
}: ButtonLinkProps): React.JSX.Element {
  return (
    <a
      className={joinClasses(VARIANT_CLASS[variant], SIZE_CLASS[size], className)}
      {...rest}
    >
      {children}
    </a>
  );
}

/** 列表列操作列：次要連結（編輯、控制台、預覽）。 */
export function ListActionLink(props: ButtonLinkProps): React.JSX.Element {
  return <ButtonLink variant="secondary" size="sm" {...props} />;
}

/** 列表列操作列：主要強調（開放、建立子項等）。 */
export function ListActionPrimary(props: ButtonProps): React.JSX.Element {
  return <Button variant="success" size="sm" {...props} />;
}

/** 列表列操作列：刪除。 */
export function ListActionDanger(props: ButtonProps): React.JSX.Element {
  return <Button variant="danger" size="sm" {...props} />;
}

const COMPACT_CLASS = "le-btn-present-compact";

/** 列表列精簡連結（對齊頂欄投影按鈕尺寸）。 */
export function ListActionCompactLink({
  variant = "secondary",
  className,
  ...props
}: ButtonLinkProps): React.JSX.Element {
  return (
    <ButtonLink
      variant={variant}
      className={joinClasses(COMPACT_CLASS, className)}
      {...props}
    />
  );
}

export function ListActionCompactPrimary(
  props: ButtonLinkProps
): React.JSX.Element {
  return <ListActionCompactLink variant="primary" {...props} />;
}

/** 列表列精簡按鈕（開始等）。 */
export function ListActionCompactSecondary({
  className,
  ...props
}: ButtonProps): React.JSX.Element {
  return (
    <Button
      variant="secondary"
      className={joinClasses(COMPACT_CLASS, className)}
      {...props}
    />
  );
}

/** 列表列精簡刪除（紅字）。 */
export function ListActionCompactDanger({
  className,
  ...props
}: ButtonProps): React.JSX.Element {
  return (
    <Button
      variant="danger"
      className={joinClasses(COMPACT_CLASS, className)}
      {...props}
    />
  );
}
