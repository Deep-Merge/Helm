import {
  getBrowserTimezoneOffset,
  getLast7DaysRange,
  toIsoDate,
  type DateRange,
} from "@/lib/date-range";

export type SubmittedFilterValues = {
  q: string;
  min_budget: string;
  max_budget: string;
  budget_type: string;
  date_from: string;
  date_to: string;
  range: string;
  tz_offset?: number;
};

export function defaultSubmittedFilters(): SubmittedFilterValues {
  const range = getLast7DaysRange();
  return {
    q: "",
    min_budget: "",
    max_budget: "",
    budget_type: "any",
    date_from: range.from,
    date_to: range.to,
    range: "",
    tz_offset: getBrowserTimezoneOffset(),
  };
}

export function parseSubmittedFilterSearchParams(
  sp: Record<string, string | undefined>,
): SubmittedFilterValues {
  if (sp.range === "all") {
    return {
      q: sp.q || "",
      min_budget: sp.min_budget || "",
      max_budget: sp.max_budget || "",
      budget_type: sp.budget_type || "any",
      date_from: "",
      date_to: "",
      range: "all",
      tz_offset: parseTimezoneOffset(sp.tz_offset),
    };
  }

  const today = toIsoDate(new Date());
  return {
    q: sp.q || "",
    min_budget: sp.min_budget || "",
    max_budget: sp.max_budget || "",
    budget_type: sp.budget_type || "any",
    date_from: sp.date_from || today,
    date_to: sp.date_to || sp.date_from || today,
    range: "",
    tz_offset: parseTimezoneOffset(sp.tz_offset),
  };
}

function parseTimezoneOffset(value: string | undefined): number | undefined {
  if (value == null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function toSubmittedSearchParams(values: SubmittedFilterValues): URLSearchParams {
  const params = new URLSearchParams();
  if (values.q.trim()) params.set("q", values.q.trim());
  if (values.min_budget) params.set("min_budget", values.min_budget);
  if (values.max_budget) params.set("max_budget", values.max_budget);
  if (values.budget_type && values.budget_type !== "any") {
    params.set("budget_type", values.budget_type);
  }
  if (values.range === "all") {
    params.set("range", "all");
  } else {
    if (values.date_from) params.set("date_from", values.date_from);
    if (values.date_to) params.set("date_to", values.date_to);
  }
  params.set("tz_offset", String(values.tz_offset ?? getBrowserTimezoneOffset()));
  return params;
}

export function submittedDateRange(values: SubmittedFilterValues): DateRange {
  return { from: values.date_from, to: values.date_to };
}

export function withDateRange(values: SubmittedFilterValues, range: DateRange): SubmittedFilterValues {
  return { ...values, date_from: range.from, date_to: range.to, range: "" };
}

export function needsDefaultDateRedirect(sp: Record<string, string | undefined>): boolean {
  return !sp.date_from && !sp.date_to && sp.range !== "all";
}

export function buildSubmittedRedirectQuery(sp: Record<string, string | undefined>): string {
  const range = getLast7DaysRange();
  const params = new URLSearchParams();
  if (sp.q) params.set("q", sp.q);
  if (sp.min_budget) params.set("min_budget", sp.min_budget);
  if (sp.max_budget) params.set("max_budget", sp.max_budget);
  if (sp.budget_type && sp.budget_type !== "any") params.set("budget_type", sp.budget_type);
  params.set("date_from", range.from);
  params.set("date_to", range.to);
  return params.toString();
}
