const DEFAULT_API_URL = "http://127.0.0.1:8000";
const DASHBOARD_URL = "http://localhost:3000";

export const LOCAL_DEV_DEFAULTS = {
  apiUrl: DEFAULT_API_URL,
  authToken: "dev-token",
  watcherEnabled: true,
} as const;

export interface Settings {
  apiUrl: string;
  authToken: string;
  defaultDirection: string;
  modelTier: "auto" | "standard" | "premium";
  watcherEnabled: boolean;
}

export async function ensureLocalDevSettings(): Promise<Settings> {
  const current = await chrome.storage.local.get([
    "apiUrl", "authToken", "defaultDirection", "modelTier", "watcherEnabled",
  ]);
  const patch: Record<string, unknown> = {};
  if (!current.apiUrl) patch.apiUrl = LOCAL_DEV_DEFAULTS.apiUrl;
  if (!current.authToken) patch.authToken = LOCAL_DEV_DEFAULTS.authToken;
  if (current.watcherEnabled === undefined) patch.watcherEnabled = LOCAL_DEV_DEFAULTS.watcherEnabled;
  if (Object.keys(patch).length) {
    await chrome.storage.local.set(patch);
  }
  return getSettings();
}

export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get([
    "apiUrl", "authToken", "defaultDirection", "modelTier", "watcherEnabled",
  ]);
  return {
    apiUrl: (result.apiUrl as string) || LOCAL_DEV_DEFAULTS.apiUrl,
    authToken: (result.authToken as string) || LOCAL_DEV_DEFAULTS.authToken,
    defaultDirection:
      (result.defaultDirection as string) ||
      "Make it confident and human. Ask to discuss in Freelancer chat.",
    modelTier: (result.modelTier as Settings["modelTier"]) || "auto",
    watcherEnabled: result.watcherEnabled !== false,
  };
}

async function readApiError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const body = JSON.parse(text) as { detail?: string | Array<{ msg?: string }> };
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail)) {
      return body.detail.map((item) => item.msg || JSON.stringify(item)).join("; ");
    }
  } catch {
    /* plain text */
  }
  return text || `API error ${res.status}`;
}

export function friendlyApiError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/invalid token|missing authorization|401/i.test(message)) {
    return "Extension not connected. Log in on the dashboard, open Connect extension, and click Connect.";
  }
  if (/quota|billing|insufficient_quota|exceeded your current quota/i.test(message)) {
    return "OpenAI billing quota exceeded. Add payment at platform.openai.com/account/billing";
  }
  if (/invalid openai api key|invalid_api_key/i.test(message)) {
    return "Invalid OpenAI API key — update OPENAI_API_KEY in apps/api/.env and restart the API.";
  }
  if (/openai rate limit/i.test(message)) {
    return message;
  }
  if (/failed to fetch|networkerror|could not reach api/i.test(message)) {
    return "API offline — start the backend on port 8000.";
  }
  return message.replace(/^\{.*\}$/s, "").trim() || "Request failed";
}

export async function verifyApiConnection(): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await getProfile();
    return { ok: true };
  } catch (error) {
    return { ok: false, message: friendlyApiError(error) };
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const settings = await getSettings();
  const res = await fetch(`${settings.apiUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.authToken}`,
      ...options.headers,
    },
  });
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  return res.json() as Promise<T>;
}

export interface GenerateResult {
  bid_id: string;
  project_id: string;
  proposal: string;
  bid_amount: number | null;
  delivery_days: number | null;
  questions: string[];
  feasibility?: "full" | "partial" | "not_feasible" | null;
  risk_score: number | null;
  risk_notes: string | null;
  fit_score?: number | null;
  key_requirements?: string[];
  model_used: string;
}

export async function generateBid(payload: Record<string, unknown>): Promise<GenerateResult> {
  return apiFetch<GenerateResult>("/bids/generate", {
    method: "POST", body: JSON.stringify(payload),
  });
}

export async function analyzeProject(payload: Record<string, unknown>) {
  return apiFetch<Record<string, unknown>>("/bids/generate", {
    method: "POST", body: JSON.stringify({ ...payload, analyze_only: true }),
  });
}

export async function regenerateBid(bidId: string, direction?: string) {
  const q = new URLSearchParams();
  if (direction) q.set("direction", direction);
  return apiFetch<GenerateResult>(`/bids/${bidId}/regenerate?${q}`, { method: "POST" });
}

export async function submitBid(payload: Record<string, unknown>): Promise<{ project: { id: string }; bid: { id: string } }> {
  const settings = await getSettings();
  const res = await fetch(`${settings.apiUrl}/bids/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.authToken}`,
    },
    body: JSON.stringify(payload),
    keepalive: true,
  });
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  return res.json() as Promise<{ project: { id: string }; bid: { id: string } }>;
}

export async function ignoreProject(projectId: string): Promise<void> {
  await apiFetch(`/projects/${projectId}/status`, {
    method: "PATCH", body: JSON.stringify({ status: "ignored" }),
  });
}

export async function syncProjects(projects: Array<Record<string, unknown>>): Promise<number> {
  const res = await apiFetch<{ synced: number }>("/projects/sync", {
    method: "POST", body: JSON.stringify({ projects }),
  });
  return res.synced;
}

export async function getProjectStatusMap(): Promise<Record<string, string>> {
  const res = await apiFetch<{ statuses: Record<string, string> }>("/projects/status-map");
  return res.statuses;
}

export interface ApiProject {
  id: string;
  freelancer_project_id: string;
  url: string;
  title: string;
  description: string;
  budget_text: string | null;
  budget_min?: number | null;
  budget_max?: number | null;
  budget_type?: "fixed" | "hourly" | "unknown";
  skills: string[];
  clarifications?: Array<{
    id: string;
    author: string;
    username: string | null;
    posted_at: string | null;
    text: string;
    is_employer_reply: boolean;
  }>;
  client_country?: string | null;
  client_location?: string | null;
  client_country_flag?: string | null;
  client_rating?: number | null;
  client_review_count?: number | null;
  status: string;
  submitted_bid_amount?: number | null;
  submitted_delivery_days?: number | null;
}

export interface ApiBid {
  id: string;
  project_id: string;
  status?: string;
  proposal_text: string;
  bid_amount: number | null;
  delivery_days: number | null;
  questions: string[];
}

export async function getProject(projectId: string): Promise<{
  project: ApiProject;
  bids: ApiBid[];
}> {
  return apiFetch(`/projects/${projectId}`);
}

export interface Profile {
  proposal_style: string | null;
  default_direction: string | null;
  default_model_tier: string;
}

export async function getProfile(): Promise<{ profile: Profile }> {
  return apiFetch("/profile");
}

export async function getAnalytics(): Promise<Record<string, number>> {
  return apiFetch("/analytics/overview");
}

export function dashboardProjectUrl(projectId: string): string {
  return `${DASHBOARD_URL}/projects/${projectId}`;
}
