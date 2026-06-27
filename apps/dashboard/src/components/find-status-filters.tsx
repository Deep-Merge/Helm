"use client";

import Link from "next/link";
import { FindPagination } from "@/components/find-pagination";
import { FilterInput } from "@/components/filter-field";
import type { ProjectPipelineStatus } from "@/lib/project-status";
import type { FindStatusFilter } from "@/lib/project-filters";

export type PipelineCounts = {
  all: number;
  new: number;
  seen: number;
  submitted: number;
};

const STATUS_OPTIONS: {
  value: FindStatusFilter;
  label: string;
  pipe?: ProjectPipelineStatus;
}[] = [
  { value: "all", label: "All" },
  { value: "new", label: "New", pipe: "new" },
  { value: "seen", label: "Seen", pipe: "seen" },
  { value: "submitted", label: "Submitted", pipe: "submitted" },
];

const ACTIVE_STYLES: Record<FindStatusFilter, string> = {
  all: "border-white/20 bg-white/[0.1] text-zinc-100 shadow-[0_0_24px_-6px_rgba(255,255,255,0.12)] ring-white/20",
  new: "border-indigo-400/50 bg-indigo-500/20 text-indigo-50 shadow-[0_0_28px_-6px_rgba(99,102,241,0.55)] ring-indigo-400/40",
  seen: "border-zinc-400/35 bg-zinc-500/15 text-zinc-100 shadow-[0_0_20px_-6px_rgba(161,161,170,0.2)] ring-zinc-400/30",
  submitted:
    "border-emerald-400/45 bg-emerald-500/20 text-emerald-50 shadow-[0_0_28px_-6px_rgba(16,185,129,0.4)] ring-emerald-400/35",
};

const COUNT_ACTIVE: Record<FindStatusFilter, string> = {
  all: "bg-white/15 text-zinc-100",
  new: "bg-indigo-400/25 text-indigo-100",
  seen: "bg-zinc-400/20 text-zinc-100",
  submitted: "bg-emerald-400/25 text-emerald-50",
};

function countForOption(value: FindStatusFilter, counts?: PipelineCounts): number | null {
  if (!counts) return null;
  return counts[value];
}

function FindProjectNameSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (q: string) => void;
}) {
  return (
    <div className="relative ml-1 min-w-[14rem] max-w-md flex-1 sm:flex-none sm:w-72">
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

export function FindStatusFilters({
  active,
  buildHref,
  page,
  totalPages,
  total,
  pageSize,
  pipelineCounts,
  showPagination = true,
  searchQuery = "",
  onSearchChange,
}: {
  active: FindStatusFilter;
  buildHref: (status: FindStatusFilter, page?: number) => string;
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  pipelineCounts?: PipelineCounts;
  showPagination?: boolean;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
}) {
  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {STATUS_OPTIONS.map((option) => {
          const isActive = active === option.value;
          const count = countForOption(option.value, pipelineCounts);

          return (
            <Link
              key={option.value}
              href={buildHref(option.value, 1)}
              scroll={false}
              aria-current={isActive ? "true" : undefined}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ring-1 ring-inset transition duration-200 ${
                isActive
                  ? ACTIVE_STYLES[option.value]
                  : "border-white/[0.06] bg-white/[0.03] text-zinc-400 ring-white/[0.08] hover:border-white/15 hover:bg-white/[0.06] hover:text-zinc-200"
              }`}
            >
              <span>{option.label}</span>
              {count != null && (
                <span
                  className={`min-w-[1.375rem] rounded-md px-1.5 py-0.5 text-center text-xs font-bold tabular-nums ${
                    isActive ? COUNT_ACTIVE[option.value] : "bg-white/[0.06] text-zinc-500"
                  }`}
                >
                  {count}
                </span>
              )}
            </Link>
          );
        })}
        {onSearchChange && (
          <FindProjectNameSearch value={searchQuery} onChange={onSearchChange} />
        )}
      </div>

      {showPagination && (
        <FindPagination
          className="ml-auto shrink-0"
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize}
          buildHref={(nextPage) => buildHref(active, nextPage)}
        />
      )}
    </div>
  );
}
