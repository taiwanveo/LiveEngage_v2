/** 標題列右側小型頁面功能按鈕（Host 各控制台一致）。 */

import * as React from "react";
import { Button, ButtonLink } from "@liveengage/ui";

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
  const variant = props.variant === "primary" ? "primary" : "secondary";
  if (props.target) {
    return (
      <ButtonLink
        href={props.href}
        variant={variant}
        size="xs"
        target={props.target}
        rel={props.rel ?? "noopener noreferrer"}
      >
        {props.children}
      </ButtonLink>
    );
  }
  return (
    <ButtonLink href={props.href} variant={variant} size="xs">
      {props.children}
    </ButtonLink>
  );
}

export function HostTitleButton(props: {
  type?: "button";
  onClick: () => void;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}): React.JSX.Element {
  const variant = props.variant === "primary" ? "primary" : "secondary";
  return (
    <Button type="button" onClick={props.onClick} variant={variant} size="xs">
      {props.children}
    </Button>
  );
}
