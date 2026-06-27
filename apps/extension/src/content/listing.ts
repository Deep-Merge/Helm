import { syncProjects, getProjectStatusMap, getSettings, ensureLocalDevSettings } from "../lib/api";

const BADGE_CLASS = "ba-listing-badge";
const STATUS_CLASS: Record<string, string> = {
  new: "ba-listing-badge--new",
  viewed: "ba-listing-badge--viewed",
  drafted: "ba-listing-badge--drafted",
  submitted: "ba-listing-badge--submitted",
  ignored: "ba-listing-badge--ignored",
};

let statusMap: Record<string, string> = {};

function extractFreelancerProjectId(href: string): string | null {
  try {
    const url = new URL(href);
    if (!url.hostname.includes("freelancer.com")) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("projects");
    if (idx === -1) return null;
    const tail = parts.slice(idx + 1).join("/");
    const fromSlug = tail.match(/-(\d{6,})$/);
    if (fromSlug) return fromSlug[1];
    const last = parts[parts.length - 1];
    if (/^\d{6,}$/.test(last)) return last;
    const anywhere = url.pathname.match(/(\d{8,})/);
    return anywhere ? anywhere[1] : null;
  } catch {
    return null;
  }
}

function extractListingProjects(): Array<Record<string, unknown>> {
  const links = document.querySelectorAll<HTMLAnchorElement>('a[href*="/projects/"]');
  const seen = new Set<string>();
  const projects: Array<Record<string, unknown>> = [];

  links.forEach((a) => {
    const projectId = extractFreelancerProjectId(a.href);
    if (!projectId || seen.has(projectId)) return;
    seen.add(projectId);

    const card = a.closest("div, li, article, fl-project-contest-card, fl-project") || a.parentElement;
    const title = a.textContent?.trim() || "Untitled";
    const budget = card?.querySelector('[class*="budget"], [class*="Budget"]')?.textContent?.trim();

    projects.push({
      freelancer_project_id: projectId,
      url: a.href.split("?")[0],
      title,
      description: "",
      budget_text: budget || null,
      skills: [],
    });

    applyBadge(card as HTMLElement, projectId);
  });

  return projects;
}

function applyBadge(card: HTMLElement | null, projectId: string) {
  if (!card) return;
  const status = statusMap[projectId] || "new";
  if (status === "ignored") {
    card.style.opacity = "0.45";
  }
  let badge = card.querySelector(`.${BADGE_CLASS}`) as HTMLElement;
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
  } catch {
    statusMap = {};
  }
}

async function poll() {
  const settings = await getSettings();
  if (!settings.watcherEnabled) return;

  await refreshStatusMap();
  const projects = extractListingProjects();
  if (projects.length === 0) return;

  try {
    const prevIds = new Set(Object.keys(statusMap));
    const synced = await syncProjects(projects);
    await refreshStatusMap();
    const newIds = Object.keys(statusMap).filter((id) => !prevIds.has(id));
    if (newIds.length > 0) {
      chrome.runtime.sendMessage({ type: "NEW_PROJECTS", count: newIds.length });
    }
    extractListingProjects();
  } catch {
    /* silent */
  }
}

setInterval(poll, 60_000);
void ensureLocalDevSettings().then(() => setTimeout(poll, 2000));
