const DEFAULT_API_URL = "http://127.0.0.1:8000";
const DASHBOARD_URL = "http://localhost:3000";
export const LOCAL_DEV_DEFAULTS = {
    apiUrl: DEFAULT_API_URL,
    authToken: "dev-token",
    watcherEnabled: true,
};
export async function ensureLocalDevSettings() {
    const current = await chrome.storage.local.get([
        "apiUrl", "authToken", "defaultDirection", "modelTier", "watcherEnabled",
    ]);
    const patch = {};
    if (!current.apiUrl)
        patch.apiUrl = LOCAL_DEV_DEFAULTS.apiUrl;
    if (!current.authToken)
        patch.authToken = LOCAL_DEV_DEFAULTS.authToken;
    if (current.watcherEnabled === undefined)
        patch.watcherEnabled = LOCAL_DEV_DEFAULTS.watcherEnabled;
    if (Object.keys(patch).length) {
        await chrome.storage.local.set(patch);
    }
    return getSettings();
}
export async function getSettings() {
    const result = await chrome.storage.local.get([
        "apiUrl", "authToken", "defaultDirection", "modelTier", "watcherEnabled",
    ]);
    return {
        apiUrl: result.apiUrl || LOCAL_DEV_DEFAULTS.apiUrl,
        authToken: result.authToken || LOCAL_DEV_DEFAULTS.authToken,
        defaultDirection: result.defaultDirection ||
            "Make it confident and human. Ask to discuss in Freelancer chat.",
        modelTier: result.modelTier || "auto",
        watcherEnabled: result.watcherEnabled !== false,
    };
}
async function readApiError(res) {
    const text = await res.text();
    try {
        const body = JSON.parse(text);
        if (typeof body.detail === "string")
            return body.detail;
        if (Array.isArray(body.detail)) {
            return body.detail.map((item) => item.msg || JSON.stringify(item)).join("; ");
        }
    }
    catch {
        /* plain text */
    }
    return text || `API error ${res.status}`;
}
export function friendlyApiError(error) {
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
export async function verifyApiConnection() {
    try {
        await getProfile();
        return { ok: true };
    }
    catch (error) {
        return { ok: false, message: friendlyApiError(error) };
    }
}
export async function apiFetch(path, options = {}) {
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
    return res.json();
}
export async function generateBid(payload) {
    return apiFetch("/bids/generate", {
        method: "POST", body: JSON.stringify(payload),
    });
}
export async function analyzeProject(payload) {
    return apiFetch("/bids/generate", {
        method: "POST", body: JSON.stringify({ ...payload, analyze_only: true }),
    });
}
export async function regenerateBid(bidId, direction) {
    const q = new URLSearchParams();
    if (direction)
        q.set("direction", direction);
    return apiFetch(`/bids/${bidId}/regenerate?${q}`, { method: "POST" });
}
export async function submitBid(payload) {
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
    return res.json();
}
export async function ignoreProject(projectId) {
    await apiFetch(`/projects/${projectId}/status`, {
        method: "PATCH", body: JSON.stringify({ status: "ignored" }),
    });
}
export async function syncProjects(projects) {
    const res = await apiFetch("/projects/sync", {
        method: "POST", body: JSON.stringify({ projects }),
    });
    return res.synced;
}
export async function getProjectStatusMap() {
    const res = await apiFetch("/projects/status-map");
    return res.statuses;
}
export async function getProject(projectId) {
    return apiFetch(`/projects/${projectId}`);
}
export async function getProfile() {
    return apiFetch("/profile");
}
export async function getAnalytics() {
    return apiFetch("/analytics/overview");
}
export function dashboardProjectUrl(projectId) {
    return `${DASHBOARD_URL}/projects/${projectId}`;
}
