import type { ProjectFilterValues } from "@/lib/project-filters";
import { deriveBudgetType } from "@/lib/project-filters";

/** Build a Freelancer.com search URL from dashboard filters (opens in browser). */
export function buildFreelancerSearchUrl(values: ProjectFilterValues): string {
  const params = new URLSearchParams();
  const terms = [values.q, values.skills]
    .flatMap((part) => part.split(","))
    .map((s) => s.trim())
    .filter(Boolean);
  if (terms.length) params.set("q", terms.join(" "));
  const budgetType = deriveBudgetType(values.type_fixed, values.type_hourly);
  if (budgetType === "fixed") params.set("projectType", "fixed");
  if (budgetType === "hourly") params.set("projectType", "hourly");
  if (values.min_budget) params.set("minbudget", values.min_budget);
  if (values.max_budget) params.set("maxbudget", values.max_budget);
  const qs = params.toString();
  return qs ? `https://www.freelancer.com/search/projects?${qs}` : "https://www.freelancer.com/search/projects";
}

export function hasActiveFindFilters(values: ProjectFilterValues): boolean {
  return Boolean(
    values.q ||
      values.skills ||
      values.exclude_countries ||
      values.min_budget ||
      values.max_budget ||
      values.min_hourly ||
      values.max_hourly ||
      values.type_fixed ||
      values.type_hourly ||
      values.days,
  );
}
