import { AnalyticsPageClient } from "@/components/analytics-page-client";
import type { AnalyticsReport } from "@/lib/analytics-client";
import { getAnalyticsReport, getSavedFilters } from "@/lib/api";

const EMPTY_REPORT: AnalyticsReport = {
  pipeline: { discovered: 0, new: 0, seen: 0, submitted: 0 },
  timeline: [],
  period_totals: { discovered: 0, seen: 0, submitted: 0 },
  granularity: "day",
  days: 7,
  skills: [],
  countries: [],
  budget_types: { fixed: 0, hourly: 0, unknown: 0 },
  submitted_analysis: {
    total: 0,
    period_total: 0,
    avg_project_budget: null,
    period_avg_project_budget: null,
    with_budget: 0,
    avg_submitted_bid: null,
    period_avg_submitted_bid: null,
    with_bid: 0,
    period_with_bid: 0,
    avg_client_rating: null,
    period_avg_client_rating: null,
    avg_competition_bids: null,
    period_avg_competition_bids: null,
    budget_types: { fixed: 0, hourly: 0, unknown: 0 },
    avg_budget_fixed: null,
    avg_budget_hourly: null,
    skills: [],
    countries: [],
    period_skills: [],
    period_countries: [],
  },
  insights: {
    view_rate_pct: 0,
    submit_rate_pct: 0,
    overall_submit_pct: 0,
    new_backlog: 0,
    period_discovered: 0,
    period_seen: 0,
    period_submitted: 0,
    avg_submitted_bid: null,
    submitted_with_bid: 0,
  },
  preset: null,
};

export default async function AnalyticsPage() {
  let report = EMPTY_REPORT;
  let presets: { id: string; name: string }[] = [];

  try {
    const params = new URLSearchParams({ days: "7", granularity: "day" });
    const [reportResult, filtersResult] = await Promise.all([
      getAnalyticsReport(params.toString()),
      getSavedFilters(),
    ]);
    report = reportResult;
    presets = (filtersResult.filters || []).map((f) => ({ id: f.id, name: f.name }));
  } catch {
    /* empty state */
  }

  return <AnalyticsPageClient initialReport={report} presets={presets} />;
}
