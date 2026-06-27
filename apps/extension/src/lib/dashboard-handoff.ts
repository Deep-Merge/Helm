import type { ApiBid, ApiProject } from "./api";
import { getProject } from "./api";
import type { BudgetType, ScrapedProject } from "./scraper";
import { extractProjectId } from "./scraper";

export const DASHBOARD_HANDOFF_STORAGE_KEY = "ba-dashboard-handoff";
const HANDOFF_TTL_MS = 5 * 60 * 1000;
const FRESH_HANDOFF_MS = 60_000;
const SUBMITTED_STATUSES = new Set(["submitted", "won", "lost"]);

export type DashboardHandoffProject = {
  dashboard_project_id: string;
  freelancer_project_id: string;
  url: string;
  title: string;
  description: string;
  budget_text: string | null;
  budget_min?: number | null;
  budget_max?: number | null;
  budget_type?: BudgetType;
  skills: string[];
  clarifications?: ScrapedProject["clarifications"];
  client_country?: string | null;
  client_location?: string | null;
  client_country_flag?: string | null;
  client_rating?: number | null;
  client_review_count?: number | null;
  status?: string;
  submitted_bid_amount?: number | null;
  submitted_delivery_days?: number | null;
};

export type SubmittedBidSnapshot = {
  bid_id?: string;
  proposal_text: string;
  questions: string[];
  bid_amount: number | null;
  delivery_days: number | null;
};

export type DashboardHandoff = {
  createdAt: number;
  autoGenerate: boolean;
  fillSubmitted: boolean;
  project: DashboardHandoffProject;
  bid?: SubmittedBidSnapshot;
};

function normalizeKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed || null;
}

export function trailingNumericId(value: string): string | null {
  const fromSlug = value.match(/-(\d{6,})$/);
  if (fromSlug) return fromSlug[1];
  if (/^\d{6,}$/.test(value)) return value;
  const anywhere = value.match(/(\d{8,})/);
  return anywhere ? anywhere[1] : null;
}

function idsMatch(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const aNum = trailingNumericId(a);
  const bNum = trailingNumericId(b);
  return !!(aNum && bNum && aNum === bNum);
}

function pathnameSlug(): string | null {
  const match = window.location.pathname.match(/\/projects\/([^/]+)/i);
  return match?.[1] ?? null;
}

export function handoffMatchesPage(handoff: DashboardHandoff): boolean {
  const handoffId = normalizeKey(handoff.project.freelancer_project_id);
  const pageId = normalizeKey(extractProjectId());
  if (idsMatch(handoffId, pageId)) return true;

  const slug = pathnameSlug();
  if (slug && idsMatch(handoffId, normalizeKey(slug))) return true;

  const pageNum = slug ? trailingNumericId(slug) : null;
  const handoffNum =
    trailingNumericId(handoff.project.freelancer_project_id) ||
    trailingNumericId(handoff.project.url);
  if (pageNum && handoffNum && pageNum === handoffNum) return true;

  try {
    const handoffPath = new URL(handoff.project.url).pathname.replace(/\/$/, "");
    const pagePath = window.location.pathname.replace(/\/$/, "");
    if (handoffPath && pagePath && handoffPath === pagePath) return true;
  } catch {
    /* ignore */
  }

  return false;
}

function isFreshHandoff(handoff: DashboardHandoff): boolean {
  return Date.now() - handoff.createdAt < FRESH_HANDOFF_MS;
}

function storedHandoffIsUsable(handoff: DashboardHandoff): boolean {
  if (!handoff.project?.dashboard_project_id) return false;
  if (!handoff.project.title?.trim()) return false;

  if (handoff.fillSubmitted) {
    if (isFreshHandoff(handoff)) return true;
    return handoffMatchesPage(handoff);
  }

  if (!handoff.autoGenerate) return false;
  if (handoff.project.status && SUBMITTED_STATUSES.has(handoff.project.status)) return false;
  if (isFreshHandoff(handoff)) return true;
  return handoffMatchesPage(handoff);
}

export function handoffToScrapedProject(handoff: DashboardHandoff): ScrapedProject {
  const project = handoff.project;
  return {
    freelancer_project_id: project.freelancer_project_id,
    url: window.location.href.split("#")[0] || project.url,
    title: project.title,
    description: project.description,
    budget_text: project.budget_text,
    budget_type: project.budget_type ?? "unknown",
    budget_min: project.budget_min,
    budget_max: project.budget_max,
    skills: project.skills ?? [],
    clarifications: project.clarifications ?? [],
    client_country: project.client_country,
    client_location: project.client_location,
    client_country_flag: project.client_country_flag,
    client_rating: project.client_rating,
    client_review_count: project.client_review_count,
  };
}

export function apiProjectToHandoff(project: ApiProject, options?: { fillSubmitted?: boolean }): DashboardHandoff {
  const fillSubmitted =
    options?.fillSubmitted ?? SUBMITTED_STATUSES.has(project.status);
  return {
    createdAt: Date.now(),
    autoGenerate: !fillSubmitted && !SUBMITTED_STATUSES.has(project.status),
    fillSubmitted,
    project: {
      dashboard_project_id: project.id,
      freelancer_project_id: project.freelancer_project_id,
      url: project.url,
      title: project.title,
      description: project.description,
      budget_text: project.budget_text,
      budget_min: project.budget_min,
      budget_max: project.budget_max,
      budget_type: project.budget_type,
      skills: project.skills ?? [],
      clarifications: project.clarifications,
      client_country: project.client_country,
      client_location: project.client_location,
      client_country_flag: project.client_country_flag,
      client_rating: project.client_rating,
      client_review_count: project.client_review_count,
      status: project.status,
      submitted_bid_amount: project.submitted_bid_amount,
      submitted_delivery_days: project.submitted_delivery_days,
    },
  };
}

function pickSubmittedBid(bids: ApiBid[]): ApiBid | null {
  if (!bids.length) return null;
  return bids.find((b) => b.status === "submitted") ?? bids[0];
}

export function bidSnapshotFromApi(project: ApiProject, bid: ApiBid | null): SubmittedBidSnapshot {
  return {
    bid_id: bid?.id,
    proposal_text: bid?.proposal_text?.trim() ?? "",
    questions: bid?.questions ?? [],
    bid_amount: project.submitted_bid_amount ?? bid?.bid_amount ?? null,
    delivery_days: project.submitted_delivery_days ?? bid?.delivery_days ?? null,
  };
}

export function attachBidToHandoff(handoff: DashboardHandoff, bid: SubmittedBidSnapshot): DashboardHandoff {
  return { ...handoff, bid };
}

function readGenerateHandoffParams(params: URLSearchParams): string | null {
  if (params.get("ba_gen") !== "1") return null;
  return params.get("ba_pid")?.trim() || null;
}

function readFillHandoffParams(params: URLSearchParams): string | null {
  if (params.get("ba_fill") !== "1") return null;
  return params.get("ba_pid")?.trim() || null;
}

function readUrlParamsFromHash(): URLSearchParams | null {
  const rawHash = window.location.hash.replace(/^#/, "").trim();
  if (!rawHash || !rawHash.includes("=")) return null;
  return new URLSearchParams(rawHash);
}

export function readUrlHandoffProjectId(): string | null {
  const fromSearch = readGenerateHandoffParams(new URLSearchParams(window.location.search));
  if (fromSearch) return fromSearch;
  const fromHash = readUrlParamsFromHash();
  if (fromHash) return readGenerateHandoffParams(fromHash);
  return null;
}

export function readUrlFillHandoffProjectId(): string | null {
  const fromSearch = readFillHandoffParams(new URLSearchParams(window.location.search));
  if (fromSearch) return fromSearch;
  const fromHash = readUrlParamsFromHash();
  if (fromHash) return readFillHandoffParams(fromHash);
  return null;
}

export function stripHandoffParamsFromUrl(): void {
  const url = new URL(window.location.href);
  let changed = false;
  if (
    url.searchParams.has("ba_pid") ||
    url.searchParams.has("ba_gen") ||
    url.searchParams.has("ba_fill")
  ) {
    url.searchParams.delete("ba_pid");
    url.searchParams.delete("ba_gen");
    url.searchParams.delete("ba_fill");
    changed = true;
  }
  if (url.hash && /(^|[&?])ba_(pid|gen|fill)=/.test(url.hash)) {
    url.hash = "";
    changed = true;
  }
  if (!changed) return;
  const next = `${url.pathname}${url.search}${url.hash}`;
  history.replaceState(history.state, "", next);
}

export function isHandoffExpired(handoff: DashboardHandoff): boolean {
  return Date.now() - handoff.createdAt > HANDOFF_TTL_MS;
}

export async function readDashboardHandoff(): Promise<DashboardHandoff | null> {
  const data = await chrome.storage.local.get(DASHBOARD_HANDOFF_STORAGE_KEY);
  const handoff = data[DASHBOARD_HANDOFF_STORAGE_KEY] as DashboardHandoff | undefined;
  if (!handoff?.project) return null;
  if (isHandoffExpired(handoff)) {
    await clearDashboardHandoff();
    return null;
  }
  return handoff;
}

export async function clearDashboardHandoff(): Promise<void> {
  await chrome.storage.local.remove(DASHBOARD_HANDOFF_STORAGE_KEY);
}

export async function fetchHandoffFromApi(dashboardProjectId: string): Promise<DashboardHandoff | null> {
  try {
    const { project } = await getProject(dashboardProjectId);
    if (SUBMITTED_STATUSES.has(project.status)) return null;
    return apiProjectToHandoff(project);
  } catch {
    return null;
  }
}

export async function fetchSubmittedFillFromApi(
  dashboardProjectId: string,
): Promise<DashboardHandoff | null> {
  try {
    const { project, bids } = await getProject(dashboardProjectId);
    const handoff = apiProjectToHandoff(project, { fillSubmitted: true });
    const bid = pickSubmittedBid(bids);
    const snapshot = bidSnapshotFromApi(project, bid);
    if (!snapshot.proposal_text && !snapshot.bid_amount && !snapshot.delivery_days) {
      return null;
    }
    return attachBidToHandoff(handoff, snapshot);
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function resolvePendingHandoffFast(): Promise<DashboardHandoff | null> {
  const stored = await readDashboardHandoff();
  if (stored?.autoGenerate && storedHandoffIsUsable(stored)) {
    return stored;
  }

  const urlProjectId = readUrlHandoffProjectId();
  if (urlProjectId) {
    if (stored?.autoGenerate && stored.project.dashboard_project_id === urlProjectId) {
      stripHandoffParamsFromUrl();
      return stored;
    }
    const fromApi = await fetchHandoffFromApi(urlProjectId);
    if (fromApi) {
      stripHandoffParamsFromUrl();
      return fromApi;
    }
  }

  await sleep(80);
  const retry = await readDashboardHandoff();
  if (retry?.autoGenerate && storedHandoffIsUsable(retry)) {
    return retry;
  }

  return null;
}

export async function resolvePendingFillHandoffFast(): Promise<DashboardHandoff | null> {
  const stored = await readDashboardHandoff();
  if (stored?.fillSubmitted && stored.bid && storedHandoffIsUsable(stored)) {
    return stored;
  }

  const urlProjectId = readUrlFillHandoffProjectId();
  if (urlProjectId) {
    const fromApi = await fetchSubmittedFillFromApi(urlProjectId);
    if (fromApi?.bid) {
      stripHandoffParamsFromUrl();
      return fromApi;
    }
    if (stored?.fillSubmitted && stored.project.dashboard_project_id === urlProjectId) {
      const hydrated = await fetchSubmittedFillFromApi(urlProjectId);
      if (hydrated?.bid) {
        stripHandoffParamsFromUrl();
        return hydrated;
      }
    }
  }

  if (stored?.fillSubmitted && storedHandoffIsUsable(stored) && stored.project.dashboard_project_id) {
    const hydrated = await fetchSubmittedFillFromApi(stored.project.dashboard_project_id);
    if (hydrated?.bid) return hydrated;
  }

  await sleep(80);
  const retry = await readDashboardHandoff();
  if (retry?.fillSubmitted && retry.bid && storedHandoffIsUsable(retry)) {
    return retry;
  }

  return null;
}

/** @deprecated Prefer resolvePendingHandoffFast for dashboard opens */
export async function resolvePendingHandoff(): Promise<DashboardHandoff | null> {
  return resolvePendingHandoffFast();
}

/** @deprecated Prefer resolvePendingFillHandoffFast for dashboard opens */
export async function resolvePendingFillHandoff(): Promise<DashboardHandoff | null> {
  return resolvePendingFillHandoffFast();
}

export function isDashboardHandoffSubmitted(handoff: DashboardHandoff): boolean {
  return Boolean(handoff.project.status && SUBMITTED_STATUSES.has(handoff.project.status));
}
