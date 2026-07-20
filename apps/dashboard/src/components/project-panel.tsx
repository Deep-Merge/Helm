"use client";

import type { ReactNode } from "react";
import { CopyButton } from "@/components/copy-button";

function PanelHeader({
  title,
  copyText,
  headerAction,
}: {
  title: string;
  copyText?: string;
  headerAction?: ReactNode;
}) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
      <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">{title}</h2>
      <div className="flex items-center gap-1.5">
        {headerAction}
        {copyText !== undefined ? (
          <CopyButton text={copyText} label={`Copy ${title.toLowerCase()}`} />
        ) : null}
      </div>
    </div>
  );
}

export function ScrollPanel({
  title,
  children,
  copyText,
  headerAction,
  className = "",
}: {
  title: string;
  children: ReactNode;
  copyText?: string;
  headerAction?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`glass flex min-h-0 flex-col overflow-hidden rounded-2xl ${className}`}
    >
      <PanelHeader title={title} copyText={copyText} headerAction={headerAction} />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
    </section>
  );
}

export function ContentPanel({
  title,
  children,
  copyText,
  className = "",
}: {
  title: string;
  children: ReactNode;
  copyText?: string;
  className?: string;
}) {
  return (
    <section className={`glass flex min-h-0 flex-col overflow-hidden rounded-2xl ${className}`}>
      <PanelHeader title={title} copyText={copyText} />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
    </section>
  );
}
