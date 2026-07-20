import type { ProjectQueryFilters } from "@/lib/api";
import { getBrowserTimezoneOffset } from "@/lib/date-range";
import { readLastFindPreset } from "@/lib/find-last-preset";
import type { FindStatusFilter, ProjectFilterValues } from "@/lib/project-filters";

function num(value: string): number | undefined {
  if (!value || value === "0") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function filterValuesToDiscoverQuery(
  filters: ProjectFilterValues,
  page: number,
  status: FindStatusFilter,
): ProjectQueryFilters & { page?: number; pipeline?: string; sort?: string } {
  const hasDateRange = filters.range !== "all" && Boolean(filters.date_from || filters.date_to);
  return {
    q: filters.q || undefined,
    exclude_countries: filters.exclude_countries || undefined,
    skills: filters.skills || undefined,
    min_budget: num(filters.min_budget),
    max_budget: num(filters.max_budget),
    min_hourly: num(filters.min_hourly),
    max_hourly: num(filters.max_hourly),
    budget_type: filters.budget_type !== "any" ? filters.budget_type : undefined,
    days: filters.days ? Number(filters.days) : undefined,
    exclude_submitted: false,
    page,
    pipeline: status !== "all" ? status : undefined,
    date_field: hasDateRange ? "seen" : undefined,
    date_from: hasDateRange ? filters.date_from || undefined : undefined,
    date_to: hasDateRange ? filters.date_to || undefined : undefined,
    tz_offset: hasDateRange ? getBrowserTimezoneOffset() : undefined,
    sort: filters.sort !== "newest" ? filters.sort : undefined,
  };
}

export function readPersistedDiscoverQuery(): ProjectQueryFilters & {
  page?: number;
  pipeline?: string;
} {
  const last = readLastFindPreset();
  if (!last) return { exclude_submitted: false, page: 1 };
  return filterValuesToDiscoverQuery(last.values, 1, last.status);
}
