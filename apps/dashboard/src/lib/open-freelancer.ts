import type { Project } from "@/lib/api";
import {
  isBackgroundOpenModifier,
  openFreelancerFromDashboardSync,
  type OpenFreelancerOptions,
} from "@/lib/extension-handoff";
import { freelancerProjectUrl } from "@/lib/freelancer-url";

export function openFreelancerInNewTab(
  project: Project,
  options: OpenFreelancerOptions = {},
): boolean {
  if (!freelancerProjectUrl(project)) return false;
  return openFreelancerFromDashboardSync(project, options);
}

export function openFreelancerFromClick(project: Project, event: Pick<MouseEvent, "ctrlKey" | "metaKey">): boolean {
  if (!isBackgroundOpenModifier(event)) {
    return false;
  }
  return openFreelancerInNewTab(project, { background: true });
}

export { openFreelancerFromDashboardSync as openFreelancerFromDashboard, isBackgroundOpenModifier } from "@/lib/extension-handoff";
