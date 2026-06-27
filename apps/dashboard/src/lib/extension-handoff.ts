import type { Project } from "@/lib/api";
import { freelancerProjectUrl } from "@/lib/freelancer-url";

const SUBMITTED_STATUSES = new Set(["submitted", "won", "lost"]);

export type ExtensionHandoffProject = {
  dashboard_project_id: string;
  freelancer_project_id: string;
  url: string;
  title: string;
  description: string;
  budget_text: string | null;
  budget_min?: number | null;
  budget_max?: number | null;
  budget_type?: "fixed" | "hourly" | "unknown";
  skills: string[];
  clarifications?: Project["clarifications"];
  client_country?: string | null;
  client_location?: string | null;
  client_country_flag?: string | null;
  client_rating?: number | null;
  client_review_count?: number | null;
  status: string;
  submitted_bid_amount?: number | null;
  submitted_delivery_days?: number | null;
};

export type OpenFreelancerOptions = {
  /** Keep focus on the dashboard tab (Ctrl/Cmd+click). */
  background?: boolean;
};

export function projectToHandoffPayload(project: Project): ExtensionHandoffProject {
  return {
    dashboard_project_id: project.id,
    freelancer_project_id: project.freelancer_project_id,
    url: freelancerProjectUrl(project) || project.url,
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
  };
}

function appendHandoffParams(url: string, project: Project): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("ba_pid", project.id);

    if (SUBMITTED_STATUSES.has(project.status)) {
      parsed.searchParams.set("ba_fill", "1");
      parsed.hash = `ba_pid=${encodeURIComponent(project.id)}&ba_fill=1`;
    } else {
      parsed.searchParams.set("ba_gen", "1");
      parsed.hash = `ba_pid=${encodeURIComponent(project.id)}&ba_gen=1`;
    }

    return parsed.toString();
  } catch {
    return url;
  }
}

export async function notifyExtensionOpenProject(project: Project): Promise<boolean> {
  const extensionId = process.env.NEXT_PUBLIC_EXTENSION_ID;
  if (!extensionId || typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
    return false;
  }

  const fillSubmitted = SUBMITTED_STATUSES.has(project.status);

  try {
    const response = await chrome.runtime.sendMessage(extensionId, {
      type: "OPEN_PROJECT",
      autoGenerate: !fillSubmitted,
      fillSubmitted,
      project: projectToHandoffPayload(project),
    });
    return response?.ok === true;
  } catch {
    return false;
  }
}

/** Open Freelancer synchronously (must run inside the click handler). */
export function openFreelancerFromDashboardSync(
  project: Project,
  options: OpenFreelancerOptions = {},
): boolean {
  const baseUrl = freelancerProjectUrl(project);
  if (!baseUrl) return false;

  const url = appendHandoffParams(baseUrl, project);
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) return false;

  if (options.background) {
    try {
      opened.blur();
      window.focus();
    } catch {
      /* ignore — browser may block refocus */
    }
  }

  void notifyExtensionOpenProject(project);
  return true;
}

export async function openFreelancerFromDashboard(
  project: Project,
  options: OpenFreelancerOptions = {},
): Promise<boolean> {
  return openFreelancerFromDashboardSync(project, options);
}

export function openFreelancerInBackground(project: Project): boolean {
  return openFreelancerFromDashboardSync(project, { background: true });
}

export function isBackgroundOpenModifier(event: Pick<MouseEvent, "ctrlKey" | "metaKey">): boolean {
  return event.ctrlKey || event.metaKey;
}
