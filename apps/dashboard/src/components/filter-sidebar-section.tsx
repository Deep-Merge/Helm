"use client";

import { useCallback, useEffect, useState } from "react";
import {
  readFilterSectionOpen,
  writeFilterSectionOpen,
  type FilterSectionId,
} from "@/lib/find-filter-sections";

export function FilterSidebarSection({
  title,
  sectionId,
  onClear,
  children,
  className = "",
  defaultOpen = true,
}: {
  title: string;
  sectionId: FilterSectionId;
  onClear?: () => void;
  children: React.ReactNode;
  className?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    setOpen(readFilterSectionOpen(sectionId, defaultOpen));
  }, [sectionId, defaultOpen]);

  const toggle = useCallback(() => {
    setOpen((value) => writeFilterSectionOpen(sectionId, !value));
  }, [sectionId]);

  return (
    <section className={`border-b border-white/[0.08] py-3 last:border-b-0 ${className}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={toggle}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={open}
        >
          <svg
            viewBox="0 0 20 20"
            className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
            fill="currentColor"
            aria-hidden
          >
            <path d="M7.5 5.5 12 10l-4.5 4.5" />
          </svg>
          <h3 className="truncate text-sm font-semibold text-zinc-100">{title}</h3>
        </button>
        {onClear && open && (
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 text-xs font-medium text-indigo-400 hover:text-indigo-300"
          >
            Clear
          </button>
        )}
      </div>
      {open && <div className="pb-1">{children}</div>}
    </section>
  );
}
