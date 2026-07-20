import type { Project } from "@/lib/api";

/** Freelancer bid page lives at .../projects/{slug}/details */
function ensureFreelancerDetailsPath(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./i, "");
    if (host !== "freelancer.com") return trimmed;

    const path = parsed.pathname.replace(/\/+$/, "");
    if (path.endsWith("/details")) return parsed.toString();
    if (!/^\/projects\/.+/i.test(path)) return trimmed;

    parsed.pathname = `${path}/details`;
    return parsed.toString();
  } catch {
    if (/\/details\/?$/i.test(trimmed)) return trimmed.replace(/\/+$/, "");
    return `${trimmed.replace(/\/+$/, "")}/details`;
  }
}

export function freelancerProjectUrl(
  project: Pick<Project, "url" | "freelancer_project_id">,
): string | null {
  const url = project.url?.trim();
  if (url) return ensureFreelancerDetailsPath(url);
  const id = project.freelancer_project_id?.trim();
  if (id) {
    return ensureFreelancerDetailsPath(`https://www.freelancer.com/projects/${id}`);
  }
  return null;
}
