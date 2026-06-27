import type { Project } from "@/lib/api";

export function freelancerProjectUrl(
  project: Pick<Project, "url" | "freelancer_project_id">,
): string | null {
  const url = project.url?.trim();
  if (url) return url;
  const id = project.freelancer_project_id?.trim();
  if (id) return `https://www.freelancer.com/projects/${id}`;
  return null;
}
