import type { Project, ProjectQueryFilters } from "@/lib/api";
import type { PipelineCounts } from "@/components/find-status-filters";

export const FIND_PAGE_SIZE = 20;
export const FIND_TABLE_PAGE_SIZE = 50;

export type DiscoverListFilters = ProjectQueryFilters & {
  page?: number;
  pipeline?: string;
  list_limit?: number;
  sort?: string;
};

function appendSharedDiscoverParams(params: URLSearchParams, filters: DiscoverListFilters) {
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
  if (filters.date_from) params.set("date_from", filters.date_from);
  if (filters.date_to) params.set("date_to", filters.date_to);
  if (filters.tz_offset != null) params.set("tz_offset", String(filters.tz_offset));
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.exclude_submitted === false) params.set("exclude_submitted", "false");
}

export function buildFindPageHref(
  filters: ProjectQueryFilters & { page?: number; pipeline?: string; sort?: string } = {},
): string {
  const params = new URLSearchParams();
  if (filters.page != null && filters.page > 1) params.set("page", String(filters.page));
  if (filters.pipeline && filters.pipeline !== "all") params.set("status", filters.pipeline);
  appendSharedDiscoverParams(params, filters);
  const qs = params.toString();
  return qs ? `/find?${qs}` : "/find";
}

export async function discoverProjectsClient(
  filters: DiscoverListFilters = {},
  options: { forceFull?: boolean; localOnly?: boolean } = {},
) {
  const params = new URLSearchParams();
  appendSharedDiscoverParams(params, filters);
  if (filters.pipeline && filters.pipeline !== "all") params.set("pipeline", filters.pipeline);
  if (options.forceFull) params.set("force_full", "true");
  if (options.localOnly) params.set("local_only", "true");
  params.set("page", String(Math.max(1, filters.page ?? 1)));
  params.set("list_limit", String(filters.list_limit ?? FIND_PAGE_SIZE));
  const qs = params.toString();

  const res = await fetch(`/api/projects/discover${qs ? `?${qs}` : ""}`, {
    method: "POST",
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = `API ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
      else if (typeof body?.error === "string") detail = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<{
    fetched: number;
    new: number;
    new_matching: number;
    new_matching_titles?: string[];
    mode: "full" | "incremental" | "local" | "rate_limited" | "throttled";
    rate_limited?: boolean;
    throttled?: boolean;
    discover_message?: string | null;
    projects: Project[];
    total: number;
    unseen: number;
    pipeline_counts?: PipelineCounts;
    page: number;
    page_size: number;
    total_pages: number;
  }>;
}

export async function markProjectViewedClient(projectId: string): Promise<boolean> {
  const res = await fetch(`/api/projects/${projectId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "viewed" }),
    cache: "no-store",
    credentials: "same-origin",
    keepalive: true,
  });
  return res.ok;
}

export async function updateProjectStatusClient(
  projectId: string,
  status: "viewed" | "submitted",
): Promise<boolean> {
  const res = await fetch(`/api/projects/${projectId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
    cache: "no-store",
    credentials: "same-origin",
  });
  return res.ok;
}
