export type AnalyticsPipeline = {
  discovered: number;
  new: number;
  seen: number;
  submitted: number;
};

export type AnalyticsTimelineRow = {
  period: string;
  label: string;
  discovered: number;
  seen: number;
  submitted: number;
};

export type AnalyticsInsights = {
  view_rate_pct: number;
  submit_rate_pct: number;
  overall_submit_pct: number;
  new_backlog: number;
  period_discovered: number;
  period_seen: number;
  period_submitted: number;
  avg_submitted_bid: number | null;
  submitted_with_bid: number;
};

export type AnalyticsSubmittedAnalysis = {
  total: number;
  period_total: number;
  avg_project_budget: number | null;
  period_avg_project_budget: number | null;
  with_budget: number;
  avg_submitted_bid: number | null;
  period_avg_submitted_bid: number | null;
  with_bid: number;
  period_with_bid: number;
  avg_client_rating: number | null;
  period_avg_client_rating: number | null;
  avg_competition_bids: number | null;
  period_avg_competition_bids: number | null;
  budget_types: { fixed: number; hourly: number; unknown: number };
  avg_budget_fixed: number | null;
  avg_budget_hourly: number | null;
  skills: { skill: string; count: number }[];
  countries: { country: string; count: number }[];
  period_skills: { skill: string; count: number }[];
  period_countries: { country: string; count: number }[];
};

export type AnalyticsReport = {
  pipeline: AnalyticsPipeline;
  timeline: AnalyticsTimelineRow[];
  period_totals: { discovered: number; seen: number; submitted: number };
  granularity: "day" | "week" | "month";
  days: number;
  skills: { skill: string; count: number }[];
  countries: { country: string; count: number }[];
  budget_types: { fixed: number; hourly: number; unknown: number };
  submitted_analysis: AnalyticsSubmittedAnalysis;
  insights: AnalyticsInsights;
  preset: { id: string; name: string } | null;
};

export type AnalyticsPreset = {
  id: string;
  name: string;
};

const PRESET_STORAGE_KEY = "bidautomation:analytics-preset";

export function readAnalyticsPresetId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(PRESET_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeAnalyticsPresetId(presetId: string | null): string | null {
  if (typeof window !== "undefined") {
    try {
      if (presetId) localStorage.setItem(PRESET_STORAGE_KEY, presetId);
      else localStorage.removeItem(PRESET_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
  return presetId;
}

async function analyticsFetch<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: "no-store", credentials: "same-origin" });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json() as Promise<T>;
}

export async function getAnalyticsPresetsClient() {
  return analyticsFetch<{ filters: AnalyticsPreset[] }>("/api/filters");
}

export async function getAnalyticsReportClient(options: {
  days?: number;
  granularity?: "day" | "week" | "month";
  presetId?: string | null;
}) {
  const params = new URLSearchParams();
  params.set("days", String(options.days ?? 7));
  params.set("granularity", options.granularity ?? "day");
  if (options.presetId) params.set("preset_id", options.presetId);
  return analyticsFetch<AnalyticsReport>(`/api/analytics/report?${params.toString()}`);
}

/** @deprecated use getAnalyticsReportClient */
export async function getAnalyticsTimelineClient(
  days = 7,
  granularity: "day" | "week" | "month" = "day",
) {
  const report = await getAnalyticsReportClient({ days, granularity });
  return {
    timeline: report.timeline,
    period_totals: report.period_totals,
    granularity: report.granularity,
    days: report.days,
  };
}

/** @deprecated use getAnalyticsReportClient */
export async function getAnalyticsSkillsClient() {
  const report = await getAnalyticsReportClient({});
  return { skills: report.skills };
}

export type AnalyticsTimeline = Pick<
  AnalyticsReport,
  "timeline" | "period_totals" | "granularity" | "days"
>;
