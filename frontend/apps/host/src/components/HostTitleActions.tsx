/** 標題列右側小型頁面功能按鈕（Host 各控制台一致）。 */

import * as React from "react";

export const hostTitleBtnPrimary =
  "le-btn-primary !min-h-[28px] !px-2.5 !py-1 !text-xs !font-normal !shadow-none";

export const hostTitleBtnSecondary =
  "le-btn-secondary !min-h-[28px] !px-2.5 !py-1 !text-xs !font-normal";

export function HostTitleActions({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">{children}</span>
  );
}

export function HostTitleLink(props: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  target?: string;
  rel?: string;
}): React.JSX.Element {
  const cls = props.variant === "primary" ? hostTitleBtnPrimary : hostTitleBtnSecondary;
  if (props.target) {
    return (
      <a
        href={props.href}
        className={cls}
        target={props.target}
        rel={props.rel ?? "noopener noreferrer"}
      >
        {props.children}
      </a>
    );
  }
  return (
    <a href={props.href} className={cls}>
      {props.children}
    </a>
  );
}

export function HostTitleButton(props: {
  type?: "button";
  onClick: () => void;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}): React.JSX.Element {
  const cls = props.variant === "primary" ? hostTitleBtnPrimary : hostTitleBtnSecondary;
  return (
    <button type="button" onClick={props.onClick} className={cls}>
      {props.children}
    </button>
  );
}
