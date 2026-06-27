"use client";

import { useCallback, useState } from "react";

export function CopyButton({
  text,
  label = "Copy",
}: {
  text: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const disabled = !text.trim();

  const copy = useCallback(async () => {
    if (disabled) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }, [disabled, text]);

  return (
    <button
      type="button"
      onClick={copy}
      disabled={disabled}
      aria-label={copied ? "Copied" : label}
      title={copied ? "Copied" : label}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-200 disabled:pointer-events-none disabled:opacity-30"
    >
      {copied ? (
        <svg
          viewBox="0 0 16 16"
          fill="none"
          className="h-3.5 w-3.5 text-emerald-400"
          aria-hidden
        >
          <path
            d="M3 8.5 6.5 12 13 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden>
          <rect
            x="5.25"
            y="5.25"
            width="7.5"
            height="7.5"
            rx="1.25"
            stroke="currentColor"
            strokeWidth="1.25"
          />
          <path
            d="M4.5 10.75V4.25A1.25 1.25 0 0 1 5.75 3h6.5"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  );
}
