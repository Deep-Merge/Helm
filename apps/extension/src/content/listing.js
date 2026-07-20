import { syncProjects, getProjectStatusMap, getSettings, ensureLocalDevSettings } from "../lib/api";
import { hydrateProjectFromFreelancerApi } from "../lib/scraper";
const BADGE_CLASS = "ba-listing-badge";
const STATUS_REFRESH_MS = 30_000;
const ACTIVE_FALLBACK_SCAN_MS = 15_000;
const IDLE_FALLBACK_SCAN_MS = 45_000;
const MUTATION_SCAN_DEBOUNCE_MS = 400;
const STATUS_CLASS = {
    new: "ba-listing-badge--new",
    viewed: "ba-listing-badge--viewed",
    drafted: "ba-listing-badge--drafted",
    submitted: "ba-listing-badge--submitted",
    ignored: "ba-listing-badge--ignored",
};
let statusMap = {};
let lastStatusMapRefreshAt = 0;
let scanTimer = null;
let pollTimer = null;
let mutationObserver = null;
let scanInFlight = false;
let rescanQueued = false;
let alertsScanTimer = null;
let alertsPollTimer = null;
let alertsScanInFlight = false;
let alertsRescanQueued = false;
const seenOnPage = new Set();
function normalizeText(value) {
    return (value || "").replace(/\s+/g, " ").trim();
}
function textLooksLikeMetaNoise(text) {
    const value = text.toLowerCase();
    return (!value ||
        /\b\d+\s+bids?\b/.test(value) ||
        /\baverage bid\b/.test(value) ||
        /\bminutes? ago\b|\bhours? ago\b|\bdays? ago\b/.test(value) ||
        /\bbudget\b.*\busd\b/.test(value) ||
        /\b(edt|est|utc|gmt)\b/.test(value) ||
        /^\$?\d+[\d,.]*(?:\s*[-–]\s*\$?\d+[\d,.]*)?(?:\s*usd)?(?:\s*per hour|\/hr)?$/i.test(text));
}
function cleanTitleCandidate(text) {
    return normalizeText(text
        .replace(/\b\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}\s+(?:EDT|EST|UTC|GMT)\b.*$/i, "")
        .replace(/\bBudget\b.*$/i, "")
        .replace(/\b\d+\s+bids?\b.*$/i, "")
        .replace(/\$\d[\d,]*(?:\s*[-–]\s*\$?\d[\d,]*)?\s*USD.*$/i, ""));
}
function chooseBestTitle(link, card) {
    const candidates = new Set();
    const add = (value) => {
        const cleaned = cleanTitleCandidate(normalizeText(value));
        if (!cleaned)
            return;
        candidates.add(cleaned);
    };
    add(link.getAttribute("title"));
    add(link.textContent);
    const titleSelectors = [
        "h1",
        "h2",
        "h3",
        "h4",
        '[class*="title" i]',
        '[class*="Title" i]',
        '[data-testid*="title" i]',
        'strong',
    ];
    for (const selector of titleSelectors) {
        card?.querySelectorAll(selector).forEach((node) => add(node.textContent));
    }
    const ranked = [...candidates]
        .filter((value) => value.length >= 8 && value.length <= 160)
        .filter((value) => !textLooksLikeMetaNoise(value))
        .sort((a, b) => a.length - b.length);
    if (ranked.length > 0) {
        return ranked[0];
    }
    const fallback = cleanTitleCandidate(link.textContent || "");
    return fallback || "Untitled";
}
function chooseDescription(card, title) {
    if (!card)
        return "";
    const candidates = new Set();
    const add = (value) => {
        const text = normalizeText(value);
        if (!text || text === title)
            return;
        if (text.length < 60 || text.length > 1200)
            return;
        if (textLooksLikeMetaNoise(text))
            return;
        candidates.add(text);
    };
    const selectors = [
        '[class*="description" i]',
        '[class*="summary" i]',
        '[class*="excerpt" i]',
        '[class*="preview" i]',
        '[data-testid*="description" i]',
        '[data-testid*="summary" i]',
    ];
    for (const selector of selectors) {
        card.querySelectorAll(selector).forEach((node) => add(node.textContent));
    }
    return [...candidates].sort((a, b) => b.length - a.length)[0] || "";
}
function looksLikeSkill(text) {
    const value = normalizeText(text);
    if (!value || value.length > 40)
        return false;
    if (textLooksLikeMetaNoise(value))
        return false;
    if (/^\d+\s+more$/i.test(value) || /^more$/i.test(value))
        return false;
    if (/^php\s+java\s+\d+\s+more$/i.test(value))
        return false;
    return /^[A-Za-z0-9+#./()\- ]+$/.test(value);
}
function extractSkills(card) {
    if (!card)
        return [];
    const skills = new Set();
    const selectors = [
        '[class*="skill" i]',
        '[class*="tag" i]',
        '[data-testid*="skill" i]',
        '[data-testid*="tag" i]',
        'a[href*="/job-search/"]',
    ];
    for (const selector of selectors) {
        card.querySelectorAll(selector).forEach((node) => {
            const value = normalizeText(node.textContent);
            if (looksLikeSkill(value)) {
                skills.add(value);
            }
        });
    }
    return [...skills].slice(0, 12);
}
function seoUrlFromProjectUrl(url) {
    try {
        const path = new URL(url).pathname;
        const match = path.match(/^\/projects\/([^/]+)/i);
        return match?.[1] ?? null;
    }
    catch {
        return null;
    }
}
function isWatcherPage() {
    const path = location.pathname;
    return /\/search\/projects/i.test(path) || /\/jobs\//i.test(path);
}
function isFreelancerSite() {
    return /(^|\.)freelancer\.com$/i.test(location.hostname);
}
/**
 * Find the "Project alerts" / notifications dropdown container that surfaces the
 * newest projects (seconds old) on any Freelancer page. This is the fastest
 * real-time source of new projects, so we watch it globally.
 */
function findAlertsContainers() {
    const containers = new Set();
    const attrMatches = document.querySelectorAll([
        'fl-notifications',
        'fl-project-alerts',
        '[class*="notification" i]',
        '[class*="Notification" i]',
        '[class*="project-alert" i]',
        '[class*="ProjectAlert" i]',
        '[data-testid*="notification" i]',
        '[data-testid*="alert" i]',
    ].join(", "));
    attrMatches.forEach((node) => {
        if (node.querySelector('a[href*="/projects/"]')) {
            containers.add(node);
        }
    });
    // Fallback: locate by the visible dropdown heading text.
    const headings = document.querySelectorAll("h1, h2, h3, h4, span, div, button, a");
    headings.forEach((node) => {
        const text = normalizeText(node.textContent).toLowerCase();
        if (text === "project alerts" ||
            text === "recent projects" ||
            text === "recent projects saved alerts") {
            const root = node.closest('fl-notifications, [class*="dropdown" i], [class*="Dropdown" i], [class*="popover" i], [class*="Popover" i], [class*="menu" i], [class*="Menu" i], [role="menu"], [role="dialog"]') || node.parentElement?.parentElement || null;
            if (root instanceof HTMLElement && root.querySelector('a[href*="/projects/"]')) {
                containers.add(root);
            }
        }
    });
    return [...containers];
}
function extractAlertsProjects() {
    const containers = findAlertsContainers();
    if (containers.length === 0)
        return [];
    const seen = new Set();
    const projects = [];
    for (const container of containers) {
        const links = container.querySelectorAll('a[href*="/projects/"]');
        links.forEach((a) => {
            const projectId = extractFreelancerProjectId(a.href);
            if (!projectId || seen.has(projectId))
                return;
            seen.add(projectId);
            const card = a.closest("li, [class*='item' i], [class*='Item' i]");
            const title = chooseBestTitle(a, card);
            projects.push({
                freelancer_project_id: projectId,
                url: a.href.split("?")[0],
                title,
                // Alerts entries are truncated; the backend/API enrichment fills the rest.
                description: "",
                budget_text: null,
                skills: [],
            });
        });
    }
    return projects;
}
function extractFreelancerProjectId(href) {
    try {
        const url = new URL(href);
        if (!url.hostname.includes("freelancer.com"))
            return null;
        const parts = url.pathname.split("/").filter(Boolean);
        const idx = parts.indexOf("projects");
        if (idx === -1)
            return null;
        const tail = parts.slice(idx + 1).join("/");
        const fromSlug = tail.match(/-(\d{6,})$/);
        if (fromSlug)
            return fromSlug[1];
        const last = parts[parts.length - 1];
        if (/^\d{6,}$/.test(last))
            return last;
        const anywhere = url.pathname.match(/(\d{8,})/);
        return anywhere ? anywhere[1] : null;
    }
    catch {
        return null;
    }
}
function findProjectCard(link) {
    const selectors = [
        "article",
        "fl-project-contest-card",
        "fl-project",
        "li",
        '[data-testid*="project"]',
        '[class*="project-card"]',
        '[class*="ProjectCard"]',
        '[class*="project-item"]',
        '[class*="ProjectItem"]',
        '[class*="search-result"]',
    ];
    for (const selector of selectors) {
        const match = link.closest(selector);
        if (match instanceof HTMLElement) {
            return match;
        }
    }
    let current = link;
    while (current && current !== document.body) {
        const text = current.innerText?.trim() || "";
        if (text.length > 80) {
            return current;
        }
        current = current.parentElement;
    }
    return link.parentElement;
}
function extractListingProjects() {
    const links = document.querySelectorAll('a[href*="/projects/"]');
    const seen = new Set();
    const projects = [];
    links.forEach((a) => {
        const projectId = extractFreelancerProjectId(a.href);
        if (!projectId || seen.has(projectId))
            return;
        seen.add(projectId);
        const card = findProjectCard(a);
        const title = chooseBestTitle(a, card);
        const budget = card?.querySelector('[class*="budget"], [class*="Budget"]')?.textContent?.trim();
        const description = chooseDescription(card, title);
        const skills = extractSkills(card);
        projects.push({
            freelancer_project_id: projectId,
            url: a.href.split("?")[0],
            title,
            description,
            budget_text: budget || null,
            skills,
        });
        applyBadge(card, projectId);
    });
    return projects;
}
function applyBadge(card, projectId) {
    if (!card)
        return;
    const status = statusMap[projectId] || "new";
    if (status === "ignored") {
        card.style.opacity = "0.45";
    }
    let badge = card.querySelector(`.${BADGE_CLASS}`);
    if (!badge) {
        badge = document.createElement("span");
        badge.className = BADGE_CLASS;
        card.style.position = "relative";
        card.appendChild(badge);
    }
    badge.className = `${BADGE_CLASS} ${STATUS_CLASS[status] || STATUS_CLASS.new}`;
    badge.textContent = status.toUpperCase();
}
async function refreshStatusMap() {
    try {
        statusMap = await getProjectStatusMap();
        lastStatusMapRefreshAt = Date.now();
    }
    catch {
        statusMap = {};
    }
}
function needsStatusRefresh(force = false) {
    return force || Date.now() - lastStatusMapRefreshAt >= STATUS_REFRESH_MS;
}
function scheduleScan(delay = MUTATION_SCAN_DEBOUNCE_MS) {
    if (!isWatcherPage())
        return;
    if (scanTimer != null) {
        window.clearTimeout(scanTimer);
    }
    scanTimer = window.setTimeout(() => {
        scanTimer = null;
        void runScan();
    }, delay);
}
async function syncNewProjects(projects) {
    const unseen = projects.filter((project) => !seenOnPage.has(project.freelancer_project_id));
    if (unseen.length === 0)
        return;
    const enriched = await Promise.all(unseen.map(async (project) => {
        const apiProject = await hydrateProjectFromFreelancerApi(project.freelancer_project_id, seoUrlFromProjectUrl(project.url));
        const merged = {
            ...project,
            ...(apiProject || {}),
            freelancer_project_id: String(apiProject?.freelancer_project_id || project.freelancer_project_id),
            url: String(apiProject?.url || project.url),
            title: String(apiProject?.title || project.title),
            description: String(apiProject?.description || project.description || ""),
            budget_text: (typeof apiProject?.budget_text === "string" ? apiProject.budget_text : null) ||
                project.budget_text,
            skills: Array.isArray(apiProject?.skills) && apiProject.skills.length > 0
                ? apiProject.skills
                : project.skills,
        };
        return merged;
    }));
    const prevIds = new Set(Object.keys(statusMap));
    await syncProjects(enriched);
    enriched.forEach((project) => {
        seenOnPage.add(project.freelancer_project_id);
    });
    await refreshStatusMap();
    const newIds = Object.keys(statusMap).filter((id) => !prevIds.has(id));
    if (newIds.length > 0) {
        chrome.runtime.sendMessage({ type: "NEW_PROJECTS", count: newIds.length });
    }
}
async function runScan(forceStatusRefresh = false) {
    if (scanInFlight) {
        rescanQueued = true;
        return;
    }
    scanInFlight = true;
    try {
        const settings = await getSettings();
        if (!settings.watcherEnabled || !isWatcherPage())
            return;
        if (needsStatusRefresh(forceStatusRefresh)) {
            await refreshStatusMap();
        }
        const projects = extractListingProjects();
        if (projects.length === 0)
            return;
        await syncNewProjects(projects);
        extractListingProjects();
    }
    catch {
        /* silent */
    }
    finally {
        scanInFlight = false;
        if (rescanQueued) {
            rescanQueued = false;
            scheduleScan(0);
        }
    }
}
async function runAlertsScan() {
    if (alertsScanInFlight) {
        alertsRescanQueued = true;
        return;
    }
    alertsScanInFlight = true;
    try {
        const settings = await getSettings();
        if (!settings.watcherEnabled || !isFreelancerSite())
            return;
        const projects = extractAlertsProjects();
        if (projects.length === 0)
            return;
        await syncNewProjects(projects);
    }
    catch {
        /* silent */
    }
    finally {
        alertsScanInFlight = false;
        if (alertsRescanQueued) {
            alertsRescanQueued = false;
            scheduleAlertsScan(0);
        }
    }
}
function scheduleAlertsScan(delay = MUTATION_SCAN_DEBOUNCE_MS) {
    if (!isFreelancerSite())
        return;
    if (alertsScanTimer != null) {
        window.clearTimeout(alertsScanTimer);
    }
    alertsScanTimer = window.setTimeout(() => {
        alertsScanTimer = null;
        void runAlertsScan();
    }, delay);
}
function currentFallbackPollMs() {
    return document.visibilityState === "visible" ? ACTIVE_FALLBACK_SCAN_MS : IDLE_FALLBACK_SCAN_MS;
}
function restartFallbackPolling() {
    if (pollTimer != null) {
        window.clearInterval(pollTimer);
    }
    pollTimer = window.setInterval(() => {
        void runScan();
    }, currentFallbackPollMs());
}
function restartAlertsPolling() {
    if (alertsPollTimer != null) {
        window.clearInterval(alertsPollTimer);
    }
    alertsPollTimer = window.setInterval(() => {
        void runAlertsScan();
    }, currentFallbackPollMs());
}
function observeListingMutations() {
    if (mutationObserver) {
        mutationObserver.disconnect();
    }
    mutationObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type !== "childList")
                continue;
            if (mutation.addedNodes.length === 0)
                continue;
            const hasElementNode = Array.from(mutation.addedNodes).some((node) => node.nodeType === Node.ELEMENT_NODE);
            if (hasElementNode) {
                if (isWatcherPage())
                    scheduleScan();
                scheduleAlertsScan();
                return;
            }
        }
    });
    mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
    });
}
function wirePageEvents() {
    document.addEventListener("visibilitychange", () => {
        restartFallbackPolling();
        restartAlertsPolling();
        if (document.visibilityState === "visible") {
            if (isWatcherPage())
                scheduleScan(0);
            scheduleAlertsScan(0);
        }
    });
    window.addEventListener("focus", () => {
        if (isWatcherPage())
            scheduleScan(0);
        scheduleAlertsScan(0);
    });
    window.addEventListener("pageshow", () => {
        if (isWatcherPage())
            scheduleScan(0);
        scheduleAlertsScan(0);
    });
    window.addEventListener("popstate", () => {
        if (isWatcherPage())
            scheduleScan(0);
        scheduleAlertsScan(0);
    });
}
async function bootstrapWatcher() {
    const settings = await getSettings();
    if (!settings.watcherEnabled || !isFreelancerSite())
        return;
    observeListingMutations();
    wirePageEvents();
    restartAlertsPolling();
    void runAlertsScan();
    if (isWatcherPage()) {
        restartFallbackPolling();
        await refreshStatusMap();
        await runScan();
    }
}
void ensureLocalDevSettings().then(() => {
    window.setTimeout(() => {
        void bootstrapWatcher();
    }, 1500);
});
