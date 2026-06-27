"use client";

import type { FindListViewMode } from "@/lib/find-list-view";

const MODES: {
  value: FindListViewMode;
  label: string;
  title: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "long",
    label: "Long list",
    title: "Expanded cards with full details",
    icon: (
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <path d="M4 5h12M4 10h12M4 15h8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    value: "short",
    label: "Short list",
    title: "Compact cards — more projects per screen",
    icon: (
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <path d="M4 6h12M4 10h12M4 14h12" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    value: "table",
    label: "Table view",
    title: "Dense table — maximum projects per page",
    icon: (
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <rect x="3" y="4" width="14" height="12" rx="1.5" />
        <path d="M3 8h14M8 8v8" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function FindListViewToggle({
  value,
  onChange,
}: {
  value: FindListViewMode;
  onChange: (mode: FindListViewMode) => void;
}) {
  return (
    <div
      className="inline-flex items-center rounded-xl bg-white/[0.04] p-0.5 ring-1 ring-white/10"
      role="group"
      aria-label="Project list view"
    >
      {MODES.map((mode) => {
        const active = value === mode.value;
        return (
          <button
            key={mode.value}
            type="button"
            onClick={() => onChange(mode.value)}
            className={`inline-flex items-center justify-center rounded-[0.65rem] p-2 transition ${
              active
                ? "bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/35"
                : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
            }`}
            aria-pressed={active}
            aria-label={mode.label}
            title={mode.title}
          >
            {mode.icon}
          </button>
        );
      })}
    </div>
  );
}
