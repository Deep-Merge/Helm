"use client";

import { useCallback } from "react";

function StepIcon({ direction }: { direction: "up" | "down" }) {
  return (
    <svg viewBox="0 0 10 10" fill="none" className="h-2.5 w-2.5" aria-hidden>
      <path
        d={direction === "up" ? "M2.5 6.5 5 3.5 7.5 6.5" : "M2.5 3.5 5 6.5 7.5 3.5"}
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PremiumNumberInput({
  label,
  value,
  onChange,
  onBlur,
  min = 0,
  step = 1,
  disabled = false,
  placeholder = "—",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  min?: number;
  step?: number;
  disabled?: boolean;
  placeholder?: string;
}) {
  const parsed = value.trim() === "" ? null : Number(value);
  const current = parsed != null && Number.isFinite(parsed) ? parsed : min;

  const applyDelta = useCallback(
    (delta: number) => {
      if (disabled) return;
      const next = Math.max(min, current + delta);
      onChange(String(next));
      onBlur?.();
    },
    [current, disabled, min, onBlur, onChange],
  );

  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </label>
      <div className="relative">
        <input
          type="number"
          min={min}
          step={step}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className="premium-number-input h-11 w-full rounded-xl border border-white/10 bg-black/25 py-0 pl-3.5 pr-[3.25rem] text-sm tabular-nums text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-indigo-400/45 focus:ring-2 focus:ring-indigo-400/15 disabled:opacity-45"
        />
        <div
          className={`absolute right-1.5 top-1/2 flex -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${
            disabled ? "pointer-events-none opacity-40" : ""
          }`}
        >
          <button
            type="button"
            tabIndex={-1}
            aria-label={`Increase ${label}`}
            onClick={() => applyDelta(step)}
            className="flex h-[18px] w-7 items-center justify-center text-zinc-500 transition hover:bg-indigo-500/20 hover:text-indigo-200 active:bg-indigo-500/30"
          >
            <StepIcon direction="up" />
          </button>
          <div className="h-px bg-white/[0.08]" aria-hidden />
          <button
            type="button"
            tabIndex={-1}
            aria-label={`Decrease ${label}`}
            onClick={() => applyDelta(-step)}
            className="flex h-[18px] w-7 items-center justify-center text-zinc-500 transition hover:bg-indigo-500/20 hover:text-indigo-200 active:bg-indigo-500/30"
          >
            <StepIcon direction="down" />
          </button>
        </div>
      </div>
    </div>
  );
}
