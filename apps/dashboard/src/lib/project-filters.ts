export type FindStatusFilter = "all" | "new" | "seen" | "submitted";

export type FindPriceSort = "newest" | "price_asc" | "price_desc";

export const FIND_PRICE_SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
] as const;

export type ProjectFilterValues = {
  q: string;
  exclude_countries: string;
  skills: string;
  min_budget: string;
  max_budget: string;
  min_hourly: string;
  max_hourly: string;
  type_fixed: boolean;
  type_hourly: boolean;
  budget_type: string;
  exclude_submitted: boolean;
  days: string;
  date_from: string;
  date_to: string;
  range: string;
  sort: FindPriceSort;
};

export type SavedFilter = {
  id: string;
  name: string;
  q?: string | null;
  countries?: string[];
  skills?: string[];
  min_budget?: number | null;
  max_budget?: number | null;
  min_hourly?: number | null;
  max_hourly?: number | null;
  budget_type?: string;
  exclude_submitted?: boolean;
  days?: number | null;
};

export function parseCsvList(value: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of value.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

export function toCsvList(items: string[]): string {
  return items.join(", ");
}

export function deriveBudgetType(typeFixed: boolean, typeHourly: boolean): string {
  if (typeFixed && !typeHourly) return "fixed";
  if (typeHourly && !typeFixed) return "hourly";
  return "any";
}

function parseProjectTypes(sp: Record<string, string | undefined>): {
  type_fixed: boolean;
  type_hourly: boolean;
} {
  if (sp.types) {
    const parts = new Set(parseCsvList(sp.types).map((t) => t.toLowerCase()));
    return {
      type_fixed: parts.has("fixed"),
      type_hourly: parts.has("hourly"),
    };
  }
  const budgetType = sp.budget_type || "any";
  if (budgetType === "fixed") return { type_fixed: true, type_hourly: false };
  if (budgetType === "hourly") return { type_fixed: false, type_hourly: true };
  return { type_fixed: false, type_hourly: false };
}

export function parseFindSort(sp: Record<string, string | undefined>): FindPriceSort {
  const value = sp.sort;
  if (value === "price_asc" || value === "price_desc") return value;
  return "newest";
}

export function parseFindStatus(sp: Record<string, string | undefined>): FindStatusFilter {
  const value = sp.status;
  if (value === "new" || value === "seen" || value === "submitted") return value;
  return "all";
}

export function parseFilterSearchParams(
  sp: Record<string, string | undefined>,
): ProjectFilterValues {
  const types = parseProjectTypes(sp);
  return {
    q: sp.q || "",
    exclude_countries: sp.exclude_countries || "",
    skills: sp.skills || "",
    min_budget: sp.min_budget || "",
    max_budget: sp.max_budget || "",
    min_hourly: sp.min_hourly || "",
    max_hourly: sp.max_hourly || "",
    ...types,
    budget_type: deriveBudgetType(types.type_fixed, types.type_hourly),
    exclude_submitted: sp.exclude_submitted === "true",
    days: sp.days || "",
    date_from: sp.range === "all" ? "" : sp.date_from || "",
    date_to: sp.range === "all" ? "" : sp.date_to || "",
    range: sp.range === "all" ? "all" : "",
    sort: parseFindSort(sp),
  };
}

export function parseFindPage(sp: Record<string, string | undefined>): number {
  const raw = parseInt(sp.page || "1", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 1;
}

export function toSearchParams(
  values: ProjectFilterValues,
  refresh = false,
  page = 1,
  status: FindStatusFilter = "all",
): URLSearchParams {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (status !== "all") params.set("status", status);
  if (values.q) params.set("q", values.q);
  if (values.exclude_countries) params.set("exclude_countries", values.exclude_countries);
  if (values.skills) params.set("skills", values.skills);
  if (values.min_budget && values.min_budget !== "0") params.set("min_budget", values.min_budget);
  if (values.max_budget) params.set("max_budget", values.max_budget);
  if (values.min_hourly && values.min_hourly !== "0") params.set("min_hourly", values.min_hourly);
  if (values.max_hourly) params.set("max_hourly", values.max_hourly);
  const types: string[] = [];
  if (values.type_fixed) types.push("fixed");
  if (values.type_hourly) types.push("hourly");
  if (types.length === 1) params.set("types", types[0]);
  if (values.exclude_submitted) params.set("exclude_submitted", "true");
  if (values.days) params.set("days", values.days);
  if (values.range === "all") {
    params.set("range", "all");
  } else {
    if (values.date_from) params.set("date_from", values.date_from);
    if (values.date_to) params.set("date_to", values.date_to);
  }
  if (values.sort && values.sort !== "newest") params.set("sort", values.sort);
  if (refresh) params.set("refresh", "1");
  return params;
}

export function findDateRange(values: ProjectFilterValues): { from: string; to: string } {
  return { from: values.date_from, to: values.date_to };
}

export function withFindDateRange(
  values: ProjectFilterValues,
  range: { from: string; to: string },
): ProjectFilterValues {
  if (!range.from && !range.to) {
    return { ...values, date_from: "", date_to: "", range: "all" };
  }
  return { ...values, date_from: range.from, date_to: range.to, range: "" };
}

export function buildDiscoverKey(_values: ProjectFilterValues): string {
  return "global";
}

export const EMPTY_FILTER_VALUES: ProjectFilterValues = {
  q: "",
  exclude_countries: "",
  skills: "",
  min_budget: "",
  max_budget: "",
  min_hourly: "",
  max_hourly: "",
  type_fixed: false,
  type_hourly: false,
  budget_type: "any",
  exclude_submitted: false,
  days: "",
  date_from: "",
  date_to: "",
  range: "",
  sort: "newest",
};

export function savedToValues(filter: SavedFilter): ProjectFilterValues {
  const budgetType = filter.budget_type || "any";
  return {
    q: filter.q || "",
    exclude_countries: (filter.countries || []).join(", "),
    skills: (filter.skills || []).join(", "),
    min_budget: filter.min_budget != null ? String(filter.min_budget) : "",
    max_budget: filter.max_budget != null ? String(filter.max_budget) : "",
    min_hourly: filter.min_hourly != null ? String(filter.min_hourly) : "",
    max_hourly: filter.max_hourly != null ? String(filter.max_hourly) : "",
    type_fixed: budgetType === "fixed",
    type_hourly: budgetType === "hourly",
    budget_type: budgetType,
    exclude_submitted: filter.exclude_submitted ?? false,
    days: filter.days != null ? String(filter.days) : "",
    date_from: "",
    date_to: "",
    range: "",
    sort: "newest",
  };
}
