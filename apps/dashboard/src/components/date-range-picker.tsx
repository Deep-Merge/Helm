"use client";

import { useEffect, useRef, useState } from "react";
import {
  addMonths,
  daysInMonth,
  formatDateRangeLabel,
  getTodayRange,
  isTodayRange,
  parseIsoDate,
  RANGE_PRESETS,
  sameDay,
  toIsoDate,
  type DateRange,
} from "@/lib/date-range";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

type PickPhase = "start" | "end";

function MonthGrid({
  viewDate,
  range,
  hoverDate,
  onPick,
  onHover,
}: {
  viewDate: Date;
  range: DateRange;
  hoverDate: string | null;
  onPick: (iso: string) => void;
  onHover: (iso: string | null) => void;
}) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const total = daysInMonth(year, month);
  const cells: (Date | null)[] = [];

  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= total; d++) cells.push(new Date(year, month, d));

  const fromDate = range.from ? parseIsoDate(range.from) : null;
  const toDate = range.to ? parseIsoDate(range.to) : null;
  const hover = hoverDate ? parseIsoDate(hoverDate) : null;

  function inRange(day: Date): boolean {
    if (!fromDate) return false;
    const end = toDate || (hover && !toDate ? hover : null);
    if (!end) return sameDay(day, fromDate);
    const start = fromDate <= end ? fromDate : end;
    const finish = fromDate <= end ? end : fromDate;
    return day >= start && day <= finish;
  }

  function isEdge(day: Date): "start" | "end" | false {
    if (fromDate && sameDay(day, fromDate)) return "start";
    if (toDate && sameDay(day, toDate)) return "end";
    if (!toDate && hover && fromDate && sameDay(day, hover)) return "end";
    return false;
  }

  return (
    <div>
      <div className="mb-3 text-center text-sm font-medium text-zinc-200">
        {viewDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
      </div>
      <div className="mb-1 grid grid-cols-7 gap-0.5">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1 text-center text-[10px] font-medium uppercase tracking-wider text-zinc-600">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} className="h-9" />;
          const iso = toIsoDate(day);
          const edge = isEdge(day);
          const ranged = inRange(day);
          const isToday = sameDay(day, new Date());

          return (
            <button
              key={iso}
              type="button"
              onClick={() => onPick(iso)}
              onMouseEnter={() => onHover(iso)}
              onMouseLeave={() => onHover(null)}
              className={`relative h-9 text-sm transition-all ${
                edge
                  ? "z-10 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 font-semibold text-white shadow-lg shadow-indigo-500/30"
                  : ranged
                    ? "bg-indigo-500/20 text-indigo-100"
                    : "rounded-lg text-zinc-300 hover:bg-white/10 hover:text-white"
              } ${isToday && !edge ? "ring-1 ring-indigo-400/50" : ""}`}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DateRangePicker({
  value,
  onChange,
  label = "Bid dates",
  compact = false,
  className = "",
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
  label?: string;
  compact?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<PickPhase>("start");
  const [draft, setDraft] = useState<DateRange>(value);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [viewDate, setViewDate] = useState(() => {
    const seed = value.from ? parseIsoDate(value.from) : new Date();
    return seed || new Date();
  });
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value.from, value.to]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  function pickDay(iso: string) {
    if (phase === "start") {
      setDraft({ from: iso, to: "" });
      setPhase("end");
      return;
    }
    const from = draft.from;
    if (!from) {
      setDraft({ from: iso, to: "" });
      setPhase("end");
      return;
    }
    if (iso < from) {
      setDraft({ from: iso, to: from });
    } else {
      setDraft({ from, to: iso });
    }
    setPhase("start");
    setHoverDate(null);
  }

  function applyPreset(next: DateRange, close = true) {
    onChange(next);
    setDraft(next);
    setPhase("start");
    setHoverDate(null);
    if (next.from) {
      const seed = parseIsoDate(next.from);
      if (seed) setViewDate(seed);
    }
    if (close) setOpen(false);
  }

  function previewPreset(next: DateRange) {
    setDraft(next);
    setPhase("start");
    if (next.from) {
      const seed = parseIsoDate(next.from);
      if (seed) setViewDate(seed);
    }
  }

  function applyDraft() {
    onChange(draft);
    setOpen(false);
  }

  function applyToday() {
    applyPreset(getTodayRange());
  }

  function clearRange() {
    applyToday();
  }

  const secondMonth = addMonths(viewDate, 1);

  return (
    <div ref={rootRef} className={`relative shrink-0 ${compact ? "" : "w-full"} ${className}`.trim()}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] text-left transition hover:border-white/15 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 ${
          compact
            ? "h-9 px-3 text-[13px] whitespace-nowrap"
            : "w-full gap-3 rounded-xl bg-gradient-to-r from-white/[0.04] to-indigo-500/[0.06] px-4 py-2.5 text-sm hover:border-indigo-500/40 hover:from-indigo-500/10"
        }`}
      >
        <span
          className={`flex shrink-0 items-center justify-center rounded-md bg-indigo-500/15 text-indigo-300 ${
            compact ? "h-6 w-6" : "h-8 w-8 rounded-lg bg-indigo-500/20"
          }`}
        >
          <svg width={compact ? 14 : 16} height={compact ? 14 : 16} viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>
        <span className={compact ? "truncate" : "min-w-0 flex-1"}>
          {!compact && (
            <span className="block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              {label}
            </span>
          )}
          <span className={`${compact ? "inline" : "block truncate"} ${value.from || value.to ? "text-zinc-200" : "text-zinc-500"}`}>
            {compact ? (
              <>
                <span className="sr-only">{label}: </span>
                {formatDateRangeLabel(value)}
              </>
            ) : (
              formatDateRangeLabel(value)
            )}
          </span>
        </span>
        {(value.from || value.to) && !compact && (
          <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] text-indigo-300">
            active
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-2 w-[680px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-white/10 bg-[#0f0f14] shadow-2xl shadow-black/60 ring-1 ring-indigo-500/20"
        >
          <div className="border-b border-white/10 bg-gradient-to-r from-indigo-500/10 via-violet-500/5 to-transparent px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-indigo-300/80">
                  Filter by bid date
                </p>
                <p className="mt-0.5 text-sm text-zinc-300">{formatDateRangeLabel(draft)}</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setViewDate((d) => addMonths(d, -1))}
                  className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 hover:bg-white/10 hover:text-white"
                  aria-label="Previous month"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={applyToday}
                  className={`rounded-lg px-4 py-1.5 text-xs font-medium transition ${
                    isTodayRange(value)
                      ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/30"
                      : "bg-indigo-500/15 text-indigo-200 ring-1 ring-indigo-500/30 hover:bg-indigo-500/25"
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setViewDate((d) => addMonths(d, 1))}
                  className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 hover:bg-white/10 hover:text-white"
                  aria-label="Next month"
                >
                  →
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-b border-white/5 px-5 py-3">
            {RANGE_PRESETS.map((preset) => {
              const r = preset.getRange();
              const active =
                preset.label === "Today"
                  ? isTodayRange(draft)
                  : draft.from === r.from && draft.to === r.to;
              return (
                <button
                  key={preset.label}
                  type="button"
                  title="Click to preview · double-click to apply"
                  onClick={() => previewPreset(preset.getRange())}
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    applyPreset(preset.getRange());
                  }}
                  className={`rounded-full px-3 py-1 text-xs ring-1 transition ${
                    active
                      ? "bg-indigo-500/25 text-indigo-100 ring-indigo-400/40"
                      : "bg-white/5 text-zinc-400 ring-white/10 hover:bg-indigo-500/15 hover:text-indigo-200"
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
            <button
              type="button"
              title="Click to preview · double-click to apply"
              onClick={() => {
                setDraft({ from: "", to: "" });
                setPhase("start");
              }}
              onDoubleClick={(e) => {
                e.preventDefault();
                applyPreset({ from: "", to: "" });
              }}
              className={`rounded-full px-3 py-1 text-xs ring-1 transition ${
                !draft.from && !draft.to
                  ? "bg-indigo-500/25 text-indigo-100 ring-indigo-400/40"
                  : "bg-white/5 text-zinc-400 ring-white/10 hover:bg-indigo-500/15 hover:text-indigo-200"
              }`}
            >
              All time
            </button>
          </div>

          <div className="grid gap-6 p-5 md:grid-cols-2">
            <MonthGrid
              viewDate={viewDate}
              range={draft}
              hoverDate={phase === "end" ? hoverDate : null}
              onPick={pickDay}
              onHover={setHoverDate}
            />
            <MonthGrid
              viewDate={secondMonth}
              range={draft}
              hoverDate={phase === "end" ? hoverDate : null}
              onPick={pickDay}
              onHover={setHoverDate}
            />
          </div>

          <div className="flex items-center justify-between border-t border-white/10 bg-black/20 px-5 py-3">
            <p className="text-xs text-zinc-500">
              {phase === "start"
                ? "Click dates to preview · double-click preset to apply"
                : "Click end date"}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={clearRange}
                className="rounded-xl px-4 py-2 text-sm text-zinc-500 hover:text-zinc-300"
              >
                Reset to today
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!draft.from && !draft.to) {
                    onChange({ from: "", to: "" });
                  } else {
                    applyDraft();
                  }
                  setOpen(false);
                }}
                disabled={!!draft.from && !draft.to}
                className="rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 disabled:opacity-40"
              >
                {!draft.from && !draft.to ? "Apply all time" : "Apply range"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
