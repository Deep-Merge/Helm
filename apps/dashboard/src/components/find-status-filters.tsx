"use client";

import { useEffect } from "react";
import { DateRangePicker } from "@/components/date-range-picker";
import { FilterSelect } from "@/components/filter-field";
import { FindPagination } from "@/components/find-pagination";
import { ProjectNameSearch } from "@/components/project-name-search";
import type { DateRange } from "@/lib/date-range";
import type { FindPriceSort, FindStatusFilter } from "@/lib/project-filters";
import { FIND_PRICE_SORT_OPTIONS } from "@/lib/project-filters";

export type PipelineCounts = {
  all: number;
  new: number;
  seen: number;
  submitted: number;
};

const STATUS_OPTIONS: {
  value: FindStatusFilter;
  label: string;
}[] = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "seen", label: "Seen" },
  { value: "submitted", label: "Submitted" },
];

function countForOption(value: FindStatusFilter, counts?: PipelineCounts): number | null {
  if (!counts) return null;
  return counts[value];
}

function statusOptions(counts?: PipelineCounts) {
  return STATUS_OPTIONS.map((option) => {
    const count = countForOption(option.value, counts);
    return {
      value: option.value,
      label: count != null ? `${option.label} (${count})` : option.label,
    };
  });
}

function RefreshNewFoundLabel({
  count,
  onDismiss,
}: {
  count: number;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (count <= 0) return;
    const id = setTimeout(onDismiss, 8000);
    return () => clearTimeout(id);
  }, [count, onDismiss]);

  if (count <= 0) return null;

  return (
    <span className="ml-1 shrink-0 text-sm font-medium tabular-nums text-emerald-300/90">
      {count} project{count !== 1 ? "s" : ""} new found
    </span>
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
  refreshNewFound = 0,
  onDismissRefreshNewFound,
  dateRange,
  onDateRangeChange,
  sort,
  onSortChange,
  onStatusChange,
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
  refreshNewFound?: number;
  onDismissRefreshNewFound?: () => void;
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  sort: FindPriceSort;
  onSortChange: (sort: FindPriceSort) => void;
  onStatusChange: (status: FindStatusFilter) => void;
}) {
  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          className="w-[9.5rem]"
          value={active}
          onChange={(value) => onStatusChange(value as FindStatusFilter)}
          options={statusOptions(pipelineCounts)}
          aria-label="Project status"
          size="toolbar"
        />

        <DateRangePicker
          compact
          value={dateRange}
          onChange={onDateRangeChange}
          label="Posted date range"
        />

        <FilterSelect
          className="w-[10.5rem]"
          value={sort}
          onChange={(value) => onSortChange(value as FindPriceSort)}
          options={[...FIND_PRICE_SORT_OPTIONS]}
          aria-label="Sort by price"
          size="toolbar"
        />

        {onSearchChange && (
          <>
            <ProjectNameSearch value={searchQuery} onChange={onSearchChange} />
            {onDismissRefreshNewFound && (
              <RefreshNewFoundLabel
                count={refreshNewFound}
                onDismiss={onDismissRefreshNewFound}
              />
            )}
          </>
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
