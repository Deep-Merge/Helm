"use client";

import { FilterNumberInput } from "@/components/filter-field";

export function FilterBudgetRange({
  min,
  max,
  onMinChange,
  onMaxChange,
  onCommit,
  maxPlaceholder = "1500+",
}: {
  min: string;
  max: string;
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
  onCommit?: () => void;
  maxPlaceholder?: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <span className="mb-1.5 block text-xs text-zinc-500">min</span>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
            $
          </span>
          <FilterNumberInput
            value={min}
            onChange={onMinChange}
            onCommit={onCommit}
            placeholder="0"
            className="[&_input]:pl-7"
          />
        </div>
        <span className="mt-1 block text-[11px] text-zinc-600">USD</span>
      </div>
      <div>
        <span className="mb-1.5 block text-xs text-zinc-500">max</span>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
            $
          </span>
          <FilterNumberInput
            value={max}
            onChange={onMaxChange}
            onCommit={onCommit}
            placeholder={maxPlaceholder}
            className="[&_input]:pl-7"
          />
        </div>
        <span className="mt-1 block text-[11px] text-zinc-600">USD</span>
      </div>
    </div>
  );
}
