import type { ClarificationEntry, Project } from "@/lib/api";
import { freelancerProjectUrl } from "@/lib/freelancer-url";

export async function updateClarificationsClient(
  projectId: string,
  clarifications: ClarificationEntry[],
  replace = true,
): Promise<{ project: Project; count: number }> {
  const res = await fetch(`/api/projects/${projectId}/clarifications`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clarifications, replace }),
  });
  if (!res.ok) {
    let detail = `API ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json();
}

export async function refreshClarificationsViaExtension(
  project: Project,
): Promise<ClarificationEntry[]> {
  const extensionId = process.env.NEXT_PUBLIC_EXTENSION_ID;
  if (!extensionId || typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
    throw new Error(
      "Helm Chrome extension required. Install it, connect on Connect extension, then open this project on Freelancer.",
    );
  }

  const response = (await chrome.runtime.sendMessage(extensionId, {
    type: "REFRESH_CLARIFICATIONS",
    projectId: project.id,
    freelancerProjectId: project.freelancer_project_id,
    url: freelancerProjectUrl(project) ?? project.url,
  })) as { ok?: boolean; clarifications?: ClarificationEntry[]; error?: string; count?: number };

  if (!response?.ok) {
    throw new Error(response?.error || "Could not refresh clarification board");
  }

  return response.clarifications ?? [];
}
