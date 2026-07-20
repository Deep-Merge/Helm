"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DateRangePicker } from "@/components/date-range-picker";
import { BUDGET_TYPE_OPTIONS, FilterNumberInput, FilterSelect } from "@/components/filter-field";
import { ProjectNameSearch } from "@/components/project-name-search";
import { getBrowserTimezoneOffset, getLast7DaysRange, type DateRange } from "@/lib/date-range";
import type { SubmittedFilterValues } from "@/lib/submitted-filters";
import {
  defaultSubmittedFilters,
  needsDefaultDateRedirect,
  submittedDateRange,
  toSubmittedSearchParams,
  withDateRange,
} from "@/lib/submitted-filters";

export function SubmittedFilters({ initial }: { initial: SubmittedFilterValues }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setValues(initial);
  }, [initial]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sp = Object.fromEntries(params.entries()) as Record<string, string | undefined>;
    const tz = String(getBrowserTimezoneOffset());
    const needsDate = needsDefaultDateRedirect(sp);
    const needsTz = params.get("tz_offset") !== tz;
    if (!needsDate && !needsTz) return;

    if (needsDate) {
      const range = getLast7DaysRange();
      params.set("date_from", range.from);
      params.set("date_to", range.to);
    }
    params.set("tz_offset", tz);
    router.replace(`/submitted?${params.toString()}`);
  }, [router]);

  function pushFilters(next: SubmittedFilterValues) {
    const withTz = { ...next, tz_offset: getBrowserTimezoneOffset() };
    setValues(withTz);
    const qs = toSubmittedSearchParams(withTz).toString();
    router.push(qs ? `/submitted?${qs}` : "/submitted");
  }

  function applyNow(next: SubmittedFilterValues) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    pushFilters(next);
  }

  function scheduleBudgetApply(next: SubmittedFilterValues) {
    setValues(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => pushFilters(next), 450);
  }

  function onDateRangeChange(range: DateRange) {
    if (!range.from && !range.to) {
      applyNow({ ...values, date_from: "", date_to: "", range: "all" });
      return;
    }
    applyNow(withDateRange(values, range));
  }

  function clearFilters() {
    applyNow(defaultSubmittedFilters());
  }

  function onSearchChange(q: string) {
    applyNow({ ...values, q });
  }

  return (
    <div className="glass overflow-visible rounded-2xl p-3">
      <div className="flex flex-wrap items-center gap-2 overflow-visible">
        <FilterSelect
          className="w-[108px]"
          value={values.budget_type}
          onChange={(budget_type) => applyNow({ ...values, budget_type })}
          options={BUDGET_TYPE_OPTIONS}
          aria-label="Project type"
        />
        <FilterNumberInput
          className="w-[136px]"
          min={0}
          value={values.min_budget}
          onChange={(min_budget) => scheduleBudgetApply({ ...values, min_budget })}
          onCommit={(min_budget) => applyNow({ ...values, min_budget })}
          placeholder="Min bid ($)"
        />
        <FilterNumberInput
          className="w-[136px]"
          min={0}
          value={values.max_budget}
          onChange={(max_budget) => scheduleBudgetApply({ ...values, max_budget })}
          onCommit={(max_budget) => applyNow({ ...values, max_budget })}
          placeholder="Max bid ($)"
        />

        <DateRangePicker
          compact
          value={submittedDateRange(values)}
          onChange={onDateRangeChange}
          label="Bid date range"
        />

        <ProjectNameSearch value={values.q} onChange={onSearchChange} />

        <button
          type="button"
          onClick={clearFilters}
          className="h-9 shrink-0 rounded-lg px-4 text-[13px] text-zinc-400 ring-1 ring-white/10 transition hover:bg-white/[0.04] hover:text-zinc-200"
        >
          Clear all
        </button>
      </div>
    </div>
  );
}
