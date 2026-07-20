import type { Project } from "@/lib/api";
import type { GenerateBidResult } from "@/lib/bids-client";
import { generateBidClient, regenerateBidClient } from "@/lib/bids-client";

export type ProposalGenerationStatus = "idle" | "generating" | "done" | "error";

type GenerationJob = {
  status: ProposalGenerationStatus;
  promise: Promise<GenerateBidResult>;
  result?: GenerateBidResult;
  error?: string;
  startedAt: number;
};

const LOCKED_STATUSES = new Set(["submitted", "won", "lost"]);

const jobs = new Map<string, GenerationJob>();
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

export function subscribeProposalGeneration(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getProposalGenerationStatus(projectId: string): ProposalGenerationStatus {
  return jobs.get(projectId)?.status ?? "idle";
}

export function getProposalGenerationError(projectId: string): string | null {
  return jobs.get(projectId)?.error ?? null;
}

export function getProposalGenerationStartedAt(projectId: string): number | null {
  return jobs.get(projectId)?.startedAt ?? null;
}

export function shouldAutoGenerateProject(project: Pick<Project, "status">): boolean {
  return !LOCKED_STATUSES.has(project.status);
}

export function ensureProposalGeneration(project: Project): Promise<GenerateBidResult> {
  const existing = jobs.get(project.id);
  if (existing) {
    if (existing.status === "generating" || existing.status === "done") {
      return existing.promise;
    }
    if (existing.status === "error") {
      jobs.delete(project.id);
    }
  }

  const startedAt = Date.now();
  const promise = generateBidClient(project)
    .then((result) => {
      const job = jobs.get(project.id);
      if (job) {
        job.status = "done";
        job.result = result;
      }
      notify();
      return result;
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : "Could not generate proposal";
      const job = jobs.get(project.id);
      if (job) {
        job.status = "error";
        job.error = message;
      }
      notify();
      throw error;
    });

  jobs.set(project.id, { status: "generating", promise, startedAt });
  notify();
  return promise;
}

export function regenerateProposalGeneration(
  project: Project,
  bidId: string,
): Promise<GenerateBidResult> {
  jobs.delete(project.id);
  notify();

  const startedAt = Date.now();
  const promise = regenerateBidClient(bidId)
    .then((result) => {
      const job = jobs.get(project.id);
      if (job) {
        job.status = "done";
        job.result = result;
      }
      notify();
      return result;
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : "Could not generate proposal";
      const job = jobs.get(project.id);
      if (job) {
        job.status = "error";
        job.error = message;
      }
      notify();
      throw error;
    });

  jobs.set(project.id, { status: "generating", promise, startedAt });
  notify();
  return promise;
}

export function generationProgressFromStartedAt(
  startedAt: number | null,
  status: ProposalGenerationStatus,
): { percent: number; label: string } {
  if (status === "done") return { percent: 100, label: "Proposal ready" };
  if (status === "error") return { percent: 100, label: "Generation failed" };
  if (status !== "generating" || startedAt == null) {
    return { percent: 0, label: "Preparing…" };
  }

  const elapsed = Date.now() - startedAt;
  const percent = Math.min(94, 6 + elapsed / 420);

  if (elapsed < 2500) return { percent, label: "Reading project details…" };
  if (elapsed < 9000) return { percent, label: "Writing your proposal…" };
  if (elapsed < 18000) return { percent, label: "Drafting questions & bid…" };
  return { percent, label: "Finalizing…" };
}
