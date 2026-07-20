import type { Project } from "@/lib/api";
import { formatProjectBudgetText } from "@/lib/project-budget";

export type GenerateBidResult = {
  bid_id: string;
  project_id: string;
  proposal: string;
  bid_amount: number | null;
  delivery_days: number | null;
  questions: string[];
  model_used?: string;
};

export async function generateBidClient(project: Project): Promise<GenerateBidResult> {
  const res = await fetch("/api/bids/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project_id: project.id,
      freelancer_project_id: project.freelancer_project_id,
      url: project.url,
      title: project.title,
      description: project.description,
      budget_text: formatProjectBudgetText(project) ?? project.budget_text,
      budget_type: project.budget_type ?? "unknown",
      skills: project.skills ?? [],
      clarifications: project.clarifications ?? [],
    }),
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

export async function regenerateBidClient(bidId: string): Promise<GenerateBidResult> {
  const res = await fetch(`/api/bids/${bidId}/regenerate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

export async function updateBidClient(
  bidId: string,
  patch: {
    bid_amount?: number | null;
    delivery_days?: number | null;
    proposal_text?: string;
    questions?: string[];
  },
): Promise<void> {
  const res = await fetch(`/api/bids/${bidId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    throw new Error(`Failed to save bid (${res.status})`);
  }
}
