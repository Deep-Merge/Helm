"use client";

import { FilterInput } from "@/components/filter-field";

export function ProjectNameSearch({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (q: string) => void;
  className?: string;
}) {
  return (
    <div
      className={`relative min-w-[14rem] max-w-md flex-1 sm:flex-none sm:w-72 ${className}`}
    >
      <svg
        viewBox="0 0 20 20"
        className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        aria-hidden
      >
        <circle cx="8.5" cy="8.5" r="5.25" />
        <path d="M13 13l3.5 3.5" strokeLinecap="round" />
      </svg>
      <FilterInput
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search by name…"
        aria-label="Search projects by name"
        className="h-[2.125rem] pl-8 pr-8 text-sm"
      />
      {value.trim() ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-zinc-500 transition hover:bg-white/10 hover:text-zinc-300"
          aria-label="Clear search"
        >
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
