/** 管理後台共用版型與 typography（頁標題、區塊標題、表單標籤）。 */

import * as React from "react";

export function AdminPageHeader(props: {
  title: string;
  description?: string;
}): React.JSX.Element {
  return (
    <header>
      <h1 className="font-display text-2xl font-bold text-foreground">{props.title}</h1>
      {props.description ? (
        <p className="mt-1 text-sm text-muted">{props.description}</p>
      ) : null}
    </header>
  );
}

export function AdminSectionTitle(props: {
  children: React.ReactNode;
  className?: string;
}): React.JSX.Element {
  return (
    <h2
      className={`text-base font-semibold text-foreground${props.className ? ` ${props.className}` : ""}`}
    >
      {props.children}
    </h2>
  );
}

export function AdminFieldLabel(props: {
  children: React.ReactNode;
  htmlFor?: string;
}): React.JSX.Element {
  return (
    <label
      htmlFor={props.htmlFor}
      className="mb-1.5 block text-sm font-medium text-foreground"
    >
      {props.children}
    </label>
  );
}

export function AdminFieldHint(props: { children: React.ReactNode }): React.JSX.Element {
  return <p className="mt-1 text-xs text-muted">{props.children}</p>;
}

export function AdminPanel(props: {
  children: React.ReactNode;
  className?: string;
}): React.JSX.Element {
  return <div className={`le-card ${props.className ?? ""}`}>{props.children}</div>;
}

export function AdminFormField(props: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}): React.JSX.Element {
  return (
    <div className={props.className}>
      <AdminFieldLabel {...(props.htmlFor ? { htmlFor: props.htmlFor } : {})}>
        {props.label}
      </AdminFieldLabel>
      {props.children}
    </div>
  );
}

export const adminInputClass = "le-input";
export const adminSelectClass = "le-input !w-auto min-w-[140px]";
export const adminBtnPrimary = "le-btn-primary !min-h-[38px] px-4 py-2 text-sm";
export const adminBtnSecondary = "le-btn-secondary !min-h-[38px] px-4 py-2 text-sm";
export const adminTableHeadClass =
  "text-left text-xs font-medium uppercase tracking-wide text-muted";
export const adminMetaBarClass =
  "border-b border-border bg-surface-elevated/40 px-4 py-3 text-xs text-muted";
