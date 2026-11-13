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
            viewBox="0 0 12 12"
            className={`h-3 w-3 shrink-0 text-zinc-500 transition-transform duration-200 ease-out ${open ? "rotate-90" : ""}`}
            fill="none"
            aria-hidden
          >
            <path
              d="M4.5 2.5 8 6l-3.5 3.5"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <h3 className="truncate text-sm font-semibold text-zinc-100">{title}</h3>
        </button>
        {onClear && open && (
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 text-xs font-medium text-indigo-400 transition-colors duration-150 hover:text-indigo-300"
          >
            Clear
          </button>
        )}
      </div>
      <div className="find-accordion" data-open={open ? "true" : "false"}>
        <div className="find-accordion-inner">
          <div className="pb-1">{children}</div>
        </div>
      </div>
    </section>
  );
}
