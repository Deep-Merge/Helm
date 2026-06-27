import { getProject } from "./api";
import { extractProjectId } from "./scraper";
export const DASHBOARD_HANDOFF_STORAGE_KEY = "ba-dashboard-handoff";
const HANDOFF_TTL_MS = 5 * 60 * 1000;
const FRESH_HANDOFF_MS = 60_000;
const SUBMITTED_STATUSES = new Set(["submitted", "won", "lost"]);
function normalizeKey(value) {
    if (!value)
        return null;
    const trimmed = value.trim().toLowerCase();
    return trimmed || null;
}
export function trailingNumericId(value) {
    const fromSlug = value.match(/-(\d{6,})$/);
    if (fromSlug)
        return fromSlug[1];
    if (/^\d{6,}$/.test(value))
        return value;
    const anywhere = value.match(/(\d{8,})/);
    return anywhere ? anywhere[1] : null;
}
function idsMatch(a, b) {
    if (!a || !b)
        return false;
    if (a === b)
        return true;
    const aNum = trailingNumericId(a);
    const bNum = trailingNumericId(b);
    return !!(aNum && bNum && aNum === bNum);
}
function pathnameSlug() {
    const match = window.location.pathname.match(/\/projects\/([^/]+)/i);
    return match?.[1] ?? null;
}
export function handoffMatchesPage(handoff) {
    const handoffId = normalizeKey(handoff.project.freelancer_project_id);
    const pageId = normalizeKey(extractProjectId());
    if (idsMatch(handoffId, pageId))
        return true;
    const slug = pathnameSlug();
    if (slug && idsMatch(handoffId, normalizeKey(slug)))
        return true;
    const pageNum = slug ? trailingNumericId(slug) : null;
    const handoffNum = trailingNumericId(handoff.project.freelancer_project_id) ||
        trailingNumericId(handoff.project.url);
    if (pageNum && handoffNum && pageNum === handoffNum)
        return true;
    try {
        const handoffPath = new URL(handoff.project.url).pathname.replace(/\/$/, "");
        const pagePath = window.location.pathname.replace(/\/$/, "");
        if (handoffPath && pagePath && handoffPath === pagePath)
            return true;
    }
    catch {
        /* ignore */
    }
    return false;
}
function isFreshHandoff(handoff) {
    return Date.now() - handoff.createdAt < FRESH_HANDOFF_MS;
}
function storedHandoffIsUsable(handoff) {
    if (!handoff.project?.dashboard_project_id)
        return false;
    if (!handoff.project.title?.trim())
        return false;
    if (handoff.fillSubmitted) {
        if (isFreshHandoff(handoff))
            return true;
        return handoffMatchesPage(handoff);
    }
    if (!handoff.autoGenerate)
        return false;
    if (handoff.project.status && SUBMITTED_STATUSES.has(handoff.project.status))
        return false;
    if (isFreshHandoff(handoff))
        return true;
    return handoffMatchesPage(handoff);
}
export function handoffToScrapedProject(handoff) {
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
export function apiProjectToHandoff(project, options) {
    const fillSubmitted = options?.fillSubmitted ?? SUBMITTED_STATUSES.has(project.status);
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
function pickSubmittedBid(bids) {
    if (!bids.length)
        return null;
    return bids.find((b) => b.status === "submitted") ?? bids[0];
}
export function bidSnapshotFromApi(project, bid) {
    return {
        bid_id: bid?.id,
        proposal_text: bid?.proposal_text?.trim() ?? "",
        questions: bid?.questions ?? [],
        bid_amount: project.submitted_bid_amount ?? bid?.bid_amount ?? null,
        delivery_days: project.submitted_delivery_days ?? bid?.delivery_days ?? null,
    };
}
export function attachBidToHandoff(handoff, bid) {
    return { ...handoff, bid };
}
function readGenerateHandoffParams(params) {
    if (params.get("ba_gen") !== "1")
        return null;
    return params.get("ba_pid")?.trim() || null;
}
function readFillHandoffParams(params) {
    if (params.get("ba_fill") !== "1")
        return null;
    return params.get("ba_pid")?.trim() || null;
}
function readUrlParamsFromHash() {
    const rawHash = window.location.hash.replace(/^#/, "").trim();
    if (!rawHash || !rawHash.includes("="))
        return null;
    return new URLSearchParams(rawHash);
}
export function readUrlHandoffProjectId() {
    const fromSearch = readGenerateHandoffParams(new URLSearchParams(window.location.search));
    if (fromSearch)
        return fromSearch;
    const fromHash = readUrlParamsFromHash();
    if (fromHash)
        return readGenerateHandoffParams(fromHash);
    return null;
}
export function readUrlFillHandoffProjectId() {
    const fromSearch = readFillHandoffParams(new URLSearchParams(window.location.search));
    if (fromSearch)
        return fromSearch;
    const fromHash = readUrlParamsFromHash();
    if (fromHash)
        return readFillHandoffParams(fromHash);
    return null;
}
export function stripHandoffParamsFromUrl() {
    const url = new URL(window.location.href);
    let changed = false;
    if (url.searchParams.has("ba_pid") ||
        url.searchParams.has("ba_gen") ||
        url.searchParams.has("ba_fill")) {
        url.searchParams.delete("ba_pid");
        url.searchParams.delete("ba_gen");
        url.searchParams.delete("ba_fill");
        changed = true;
    }
    if (url.hash && /(^|[&?])ba_(pid|gen|fill)=/.test(url.hash)) {
        url.hash = "";
        changed = true;
    }
    if (!changed)
        return;
    const next = `${url.pathname}${url.search}${url.hash}`;
    history.replaceState(history.state, "", next);
}
export function isHandoffExpired(handoff) {
    return Date.now() - handoff.createdAt > HANDOFF_TTL_MS;
}
export async function readDashboardHandoff() {
    const data = await chrome.storage.local.get(DASHBOARD_HANDOFF_STORAGE_KEY);
    const handoff = data[DASHBOARD_HANDOFF_STORAGE_KEY];
    if (!handoff?.project)
        return null;
    if (isHandoffExpired(handoff)) {
        await clearDashboardHandoff();
        return null;
    }
    return handoff;
}
export async function clearDashboardHandoff() {
    await chrome.storage.local.remove(DASHBOARD_HANDOFF_STORAGE_KEY);
}
export async function fetchHandoffFromApi(dashboardProjectId) {
    try {
        const { project } = await getProject(dashboardProjectId);
        if (SUBMITTED_STATUSES.has(project.status))
            return null;
        return apiProjectToHandoff(project);
    }
    catch {
        return null;
    }
}
export async function fetchSubmittedFillFromApi(dashboardProjectId) {
    try {
        const { project, bids } = await getProject(dashboardProjectId);
        const handoff = apiProjectToHandoff(project, { fillSubmitted: true });
        const bid = pickSubmittedBid(bids);
        const snapshot = bidSnapshotFromApi(project, bid);
        if (!snapshot.proposal_text && !snapshot.bid_amount && !snapshot.delivery_days) {
            return null;
        }
        return attachBidToHandoff(handoff, snapshot);
    }
    catch {
        return null;
    }
}
function sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}
export async function resolvePendingHandoffFast() {
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
export async function resolvePendingFillHandoffFast() {
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
        if (hydrated?.bid)
            return hydrated;
    }
    await sleep(80);
    const retry = await readDashboardHandoff();
    if (retry?.fillSubmitted && retry.bid && storedHandoffIsUsable(retry)) {
        return retry;
    }
    return null;
}
/** @deprecated Prefer resolvePendingHandoffFast for dashboard opens */
export async function resolvePendingHandoff() {
    return resolvePendingHandoffFast();
}
/** @deprecated Prefer resolvePendingFillHandoffFast for dashboard opens */
export async function resolvePendingFillHandoff() {
    return resolvePendingFillHandoffFast();
}
export function isDashboardHandoffSubmitted(handoff) {
    return Boolean(handoff.project.status && SUBMITTED_STATUSES.has(handoff.project.status));
}
