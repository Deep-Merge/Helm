import type { Project } from "@/lib/api";

type BudgetFields = Pick<
  Project,
  "budget_text" | "budget_min" | "budget_max" | "budget_type" | "bid_currency_sign" | "bid_currency_code"
>;

function formatAmount(value: number): string {
  return Math.round(value).toLocaleString();
}

/** e.g. "$15 – $25 USD per hour" or "$500 – $1,000 USD" */
export function formatProjectBudgetText(project: BudgetFields): string | null {
  const text = project.budget_text?.trim();
  if (text) {
    const isHourly = project.budget_type === "hourly";
    if (isHourly && !/per hour|\/\s*hr/i.test(text)) {
      return `${text} per hour`;
    }
    return text;
  }

  const sign = project.bid_currency_sign || "$";
  const code = project.bid_currency_code || "USD";
  const isHourly = project.budget_type === "hourly";
  const hourlySuffix = isHourly ? " per hour" : "";

  const min = project.budget_min;
  const max = project.budget_max;

  if (min != null || max != null) {
    const lo = min ?? max;
    const hi = max ?? min;
    if (lo == null) return null;
    if (hi != null && lo !== hi) {
      return `${sign}${formatAmount(lo)} – ${sign}${formatAmount(hi)} ${code}${hourlySuffix}`;
    }
    return `${sign}${formatAmount(lo)} ${code}${hourlySuffix}`;
  }

  return null;
}

export function formatProjectBudgetLabel(project: BudgetFields): string | null {
  const text = formatProjectBudgetText(project);
  return text ? `Budget ${text}` : null;
}
