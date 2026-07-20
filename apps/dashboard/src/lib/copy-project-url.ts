import type { Project } from "@/lib/api";
import { freelancerProjectUrl } from "@/lib/freelancer-url";

export async function copyProjectUrlToClipboard(
  project: Pick<Project, "url" | "freelancer_project_id">,
): Promise<boolean> {
  const url = freelancerProjectUrl(project);
  if (!url) return false;
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}
