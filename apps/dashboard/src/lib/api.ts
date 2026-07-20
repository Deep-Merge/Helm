import { authorizationHeader } from "@/lib/auth-token";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(await authorizationHeader()),
      ...init?.headers,
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export interface ClarificationEntry {
  id: string;
  author: string;
  username: string | null;
  posted_at: string | null;
  text: string;
  is_employer_reply: boolean;
  thread_id?: string | null;
  parent_id?: string | null;
  depth?: number;
  sort_order?: number;
}

export interface Project {
  id: string;
  freelancer_project_id: string;
  url: string;
  title: string;
  description: string;
  budget_text: string | null;
  budget_min?: number | null;
  budget_max?: number | null;
  budget_type?: "fixed" | "hourly" | "unknown";
  client_country?: string | null;
  client_country_flag?: string | null;
  client_location?: string | null;
  client_rating?: number | null;
  client_review_count?: number | null;
  bid_count?: number | null;
  bid_avg?: number | null;
  bid_currency_code?: string | null;
  bid_currency_sign?: string | null;
  submitted_bid_amount?: number | null;
  submitted_delivery_days?: number | null;
  skills: string[];
  clarifications?: ClarificationEntry[];
  status: string;
  risk_score: number | null;
  risk_notes?: string | null;
  first_seen_at: string;
  discovered_at?: string | null;
  freelancer_posted_at?: string | null;
  submitted_at: string | null;
}

export interface Bid {
  id: string;
  project_id: string;
  version: number;
  status?: string;
  proposal_text: string;
  bid_amount: number | null;
  delivery_days: number | null;
  questions: string[];
  model_used: string | null;
  created_at: string;
  project_title?: string;
  project_url?: string;
}

export interface Profile {
  id: string;
  display_name: string | null;
  title: string | null;
  bio: string | null;
  skills: string[];
  proposal_style: string | null;
  default_direction: string | null;
  default_model_tier: string;
}

export interface SavedFilter {
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
}

export interface WatcherConfig {
  id: string;
  name: string;
  search_url: string;
  keywords: string[];
  poll_interval_sec: number;
  is_active: boolean;
}

export interface Template {
  id: string;
  name: string;
  content: string;
  tags: string[];
  is_winning_example: boolean;
}

export interface ProjectEvent {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
  project_title?: string;
}

export async function getOverview() {
  return apiFetch<{
    projects_discovered: number;
    projects_viewed: number;
    proposals_generated: number;
    submitted: number;
    submission_rate: number;
    win_rate: number;
  }>("/analytics/overview");
}

export async function getProjects(status?: string, q?: string) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (q) params.set("q", q);
  const qs = params.toString();
  return apiFetch<{ projects: Project[]; total: number }>(`/projects${qs ? `?${qs}` : ""}`);
}

export type ProjectQueryFilters = {
  q?: string;
  exclude_countries?: string;
  skills?: string;
  min_budget?: number;
  max_budget?: number;
  min_hourly?: number;
  max_hourly?: number;
  budget_type?: string;
  types?: string;
  exclude_submitted?: boolean;
  days?: number;
  date_field?: "seen" | "submitted";
  date_from?: string;
  date_to?: string;
  tz_offset?: number;
  bid_min?: number;
  bid_max?: number;
  status?: string;
  sort?: string;
  limit?: number;
  offset?: number;
  include_day_counts?: boolean;
};
export async function discoverProjects(
  filters: ProjectQueryFilters = {},
  options: { forceFull?: boolean; localOnly?: boolean } = {},
) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.exclude_countries) params.set("exclude_countries", filters.exclude_countries);
  if (filters.skills) params.set("skills", filters.skills);
  if (filters.min_budget != null) params.set("min_budget", String(filters.min_budget));
  if (filters.max_budget != null) params.set("max_budget", String(filters.max_budget));
  if (filters.min_hourly != null) params.set("min_hourly", String(filters.min_hourly));
  if (filters.max_hourly != null) params.set("max_hourly", String(filters.max_hourly));
  if (filters.budget_type) params.set("budget_type", filters.budget_type);
  if (filters.types) params.set("types", filters.types);
  if (filters.days != null) params.set("days", String(filters.days));
  if (filters.exclude_submitted === false) params.set("exclude_submitted", "false");
  if (options.forceFull) params.set("force_full", "true");
  if (options.localOnly) params.set("local_only", "true");
  const qs = params.toString();
  return apiFetch<{
    fetched: number;
    new: number;
    mode: "full" | "incremental" | "local";
    projects: Project[];
    total: number;
  }>(`/projects/discover${qs ? `?${qs}` : ""}`, { method: "POST" });
}

export async function getProjectsWithFilters(filters: ProjectQueryFilters = {}) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.exclude_countries) params.set("exclude_countries", filters.exclude_countries);
  if (filters.skills) params.set("skills", filters.skills);
  if (filters.min_budget != null) params.set("min_budget", String(filters.min_budget));
  if (filters.max_budget != null) params.set("max_budget", String(filters.max_budget));
  if (filters.min_hourly != null) params.set("min_hourly", String(filters.min_hourly));
  if (filters.max_hourly != null) params.set("max_hourly", String(filters.max_hourly));
  if (filters.budget_type) params.set("budget_type", filters.budget_type);
  if (filters.types) params.set("types", filters.types);
  if (filters.exclude_submitted) params.set("exclude_submitted", "true");
  if (filters.days != null) params.set("days", String(filters.days));
  if (filters.date_field) params.set("date_field", filters.date_field);
  if (filters.date_from) params.set("date_from", filters.date_from);
  if (filters.date_to) params.set("date_to", filters.date_to);
  if (filters.tz_offset != null) params.set("tz_offset", String(filters.tz_offset));
  if (filters.bid_min != null) params.set("bid_min", String(filters.bid_min));
  if (filters.bid_max != null) params.set("bid_max", String(filters.bid_max));
  if (filters.status) params.set("status", filters.status);
  if (filters.limit != null) params.set("limit", String(filters.limit));
  if (filters.offset != null) params.set("offset", String(filters.offset));
  if (filters.include_day_counts) params.set("include_day_counts", "true");
  const qs = params.toString();
  return apiFetch<{ projects: Project[]; total: number; day_counts?: Record<string, number> }>(
    `/projects${qs ? `?${qs}` : ""}`,
  );
}

export async function getSavedFilters() {
  return apiFetch<{ filters: SavedFilter[] }>("/filters");
}

export async function getProject(id: string) {
  return apiFetch<{ project: Project; bids: Bid[]; events: ProjectEvent[] }>(`/projects/${id}`);
}

export async function updateProjectStatus(id: string, status: string) {
  return apiFetch<{ project: Project }>(`/projects/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function getBids() {
  return apiFetch<{ bids: Bid[] }>("/bids");
}

export async function getProfile() {
  return apiFetch<{ profile: Profile }>("/profile");
}

export async function getHealth() {
  return apiFetch<{
    status: string;
    dev_mode: boolean;
    ai_configured: boolean;
    supabase_configured: boolean;
  }>("/health");
}

export async function getRecentEvents() {
  return apiFetch<{ events: ProjectEvent[] }>("/events/recent");
}

export async function getAnalyticsFunnel() {
  return apiFetch<Record<string, number>>("/analytics/funnel");
}

export async function getAnalyticsSkills() {
  return apiFetch<{ skills: { skill: string; count: number }[] }>("/analytics/skills");
}

export async function getProjectSkills() {
  return apiFetch<{ skills: { skill: string; count: number }[] }>("/projects/skills");
}

export async function getAnalyticsActivity(days = 30) {
  return apiFetch<{ activity: { date: string; discovered: number; submitted: number }[] }>(
    `/analytics/activity?days=${days}`
  );
}

export type { AnalyticsPipeline, AnalyticsReport, AnalyticsTimeline, AnalyticsTimelineRow } from "@/lib/analytics-client";

export async function getAnalyticsReport(queryString: string) {
  return apiFetch<import("@/lib/analytics-client").AnalyticsReport>(
    `/analytics/report?${queryString}`,
  );
}

export async function getAnalyticsPipeline() {
  return apiFetch<import("@/lib/analytics-client").AnalyticsPipeline>("/analytics/pipeline");
}

export async function getAnalyticsTimeline(days = 30, granularity: "day" | "week" | "month" = "day") {
  return apiFetch<import("@/lib/analytics-client").AnalyticsTimeline>(
    `/analytics/timeline?days=${days}&granularity=${granularity}`,
  );
}

export async function getWatcherConfigs() {
  return apiFetch<{ configs: WatcherConfig[] }>("/watcher/configs");
}

export async function getTemplates() {
  return apiFetch<{ templates: Template[] }>("/templates");
}

export function getExportCsvUrl() {
  return `${API_URL}/export/csv`;
}
