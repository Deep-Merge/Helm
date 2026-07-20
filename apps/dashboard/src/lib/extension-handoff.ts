import type { Project } from "@/lib/api";
import { freelancerProjectUrl } from "@/lib/freelancer-url";

export type OpenFreelancerOptions = {
  /** Keep focus on the dashboard tab (Ctrl/Cmd+click). */
  background?: boolean;
};

/** Open Freelancer synchronously (must run inside the click handler). */
export function openFreelancerFromDashboardSync(
  project: Project,
  options: OpenFreelancerOptions = {},
): boolean {
  const url = freelancerProjectUrl(project);
  if (!url) return false;

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
