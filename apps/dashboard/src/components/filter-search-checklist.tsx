"use client";

import { useMemo, useState } from "react";

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden>
      <path
        d="M9 3.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="m14.5 14.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function FilterSearchChecklist({
  options,
  selected,
  onChange,
  placeholder,
  maxVisible = 8,
}: {
  options: readonly string[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  maxVisible?: number;
}) {
  const [query, setQuery] = useState("");
  const selectedSet = useMemo(() => new Set(selected.map((s) => s.toLowerCase())), [selected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
    const selectedItems = selected.filter(
      (item) => !q || item.toLowerCase().includes(q),
    );
    const rest = list.filter((o) => !selectedSet.has(o.toLowerCase()));
    return [...selectedItems, ...rest].slice(0, maxVisible + selectedItems.length);
  }, [options, query, selected, selectedSet, maxVisible]);

  const trimmedQuery = query.trim();
  const canAddCustom =
    trimmedQuery.length > 0 &&
    !options.some((o) => o.toLowerCase() === trimmedQuery.toLowerCase()) &&
    !selectedSet.has(trimmedQuery.toLowerCase());

  function addCustom() {
    if (!canAddCustom) return;
    onChange([...selected, trimmedQuery]);
    setQuery("");
  }

  function toggle(option: string) {
    const key = option.toLowerCase();
    if (selectedSet.has(key)) {
      onChange(selected.filter((s) => s.toLowerCase() !== key));
      return;
    }
    onChange([...selected, option]);
  }

  return (
    <div className="space-y-3">
      <label className="relative block">
        <span className="sr-only">{placeholder}</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder={placeholder}
          className="h-10 w-full rounded-full border border-white/10 bg-white/[0.03] py-2 pr-3 pl-9 text-sm text-zinc-200 outline-none transition placeholder:text-zinc-500 hover:border-white/15 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20"
        />
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
          <SearchIcon />
        </span>
      </label>

      <ul className="space-y-1">
        {canAddCustom && (
          <li>
            <button
              type="button"
              onClick={addCustom}
              className="w-full rounded-lg px-1 py-1.5 text-left text-sm text-indigo-300 hover:bg-white/[0.04]"
            >
              Add &ldquo;{trimmedQuery}&rdquo;
            </button>
          </li>
        )}
        {filtered.map((option) => {
          const checked = selectedSet.has(option.toLowerCase());
          return (
            <li key={option}>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-1.5 text-sm text-zinc-300 hover:bg-white/[0.04]">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(option)}
                  className="h-4 w-4 rounded border-white/20 bg-white/[0.03] text-indigo-500 focus:ring-indigo-500/30"
                />
                <span className="leading-snug">{option}</span>
              </label>
            </li>
          );
        })}
        {filtered.length === 0 && !canAddCustom && (
          <li className="px-1 py-2 text-sm text-zinc-500">No matches</li>
        )}
      </ul>
    </div>
  );
}
