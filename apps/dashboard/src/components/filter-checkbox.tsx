"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

function CheckIcon() {
  return (
    <svg viewBox="0 0 12 12" fill="none" className="h-2.5 w-2.5" aria-hidden>
      <path
        d="M2.5 6.2 5 8.7 9.5 3.8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FilterCheckboxBox({ checked }: { checked: boolean }) {
  return (
    <span
      className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-all duration-150 ${
        checked
          ? "border-indigo-400/60 bg-indigo-500 text-white shadow-[0_0_14px_-6px_rgba(99,102,241,0.9)]"
          : "border-white/12 bg-white/[0.02] text-transparent group-hover:border-white/22 group-hover:bg-white/[0.04]"
      }`}
      aria-hidden
    >
      <CheckIcon />
    </span>
  );
}

export function FilterCheckboxRow({
  checked,
  onToggle,
  children,
  leading,
  trailing,
}: {
  checked: boolean;
  onToggle: () => void;
  children: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      onMouseDown={(event) => event.preventDefault()}
      className={`group flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition-colors duration-150 ${
        checked
          ? "bg-indigo-500/[0.08] text-zinc-100"
          : "text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-300"
      }`}
    >
      <FilterCheckboxBox checked={checked} />
      {leading}
      <span className="min-w-0 flex-1 leading-snug">{children}</span>
      {trailing}
    </button>
  );
}

export function FilterSelectedPill({
  children,
  onRemove,
  leading,
}: {
  children: ReactNode;
  onRemove: () => void;
  leading?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="group inline-flex max-w-full items-center gap-1.5 rounded-full bg-indigo-500/10 py-1 pl-2 pr-2.5 text-xs text-indigo-100/90 ring-1 ring-indigo-500/20 transition hover:bg-indigo-500/15"
      title="Remove filter"
    >
      {leading}
      <span className="truncate">{children}</span>
      <span
        className="ml-0.5 text-indigo-300/50 transition group-hover:text-indigo-200/80"
        aria-hidden
      >
        ×
      </span>
    </button>
  );
}

export function FilterSearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="relative block">
      <span className="sr-only">{placeholder}</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-xl border border-white/[0.08] bg-white/[0.02] py-2 pr-3 pl-9 text-sm text-zinc-200 outline-none transition placeholder:text-zinc-600 hover:border-white/12 focus:border-indigo-500/40 focus:bg-white/[0.03] focus:ring-1 focus:ring-indigo-500/25"
      />
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600">
        <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden>
          <path
            d="M9 3.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path d="m14.5 14.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
    </label>
  );
}

export function FilterScrollList({
  children,
  maxHeightClass = "max-h-56",
}: {
  children: ReactNode;
  maxHeightClass?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const scrollTopRef = useRef(0);

  useLayoutEffect(() => {
    const node = scrollerRef.current;
    if (node) node.scrollTop = scrollTopRef.current;
  });

  return (
    <div
      ref={scrollerRef}
      className={`${maxHeightClass} overflow-y-auto overscroll-contain [overflow-anchor:none]`}
      onScroll={(event) => {
        scrollTopRef.current = event.currentTarget.scrollTop;
      }}
    >
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}
