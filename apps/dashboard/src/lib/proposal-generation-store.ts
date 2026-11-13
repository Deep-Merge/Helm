import type { Project } from "@/lib/api";
import type { GenerateBidResult } from "@/lib/bids-client";
import { generateBidClient, regenerateBidClient } from "@/lib/bids-client";

export type ProposalGenerationStatus = "idle" | "generating" | "done" | "error";

type GenerationJob = {
  status: ProposalGenerationStatus;
  kind: "generate" | "watch";
  promise: Promise<GenerateBidResult>;
  result?: GenerateBidResult;
  error?: string;
  startedAt: number;
  abort?: AbortController;
};

const LOCKED_STATUSES = new Set(["submitted", "won", "lost"]);
const CHANNEL_NAME = "helm-proposal-generation";

const jobs = new Map<string, GenerationJob>();
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function generationChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return null;
  return new BroadcastChannel(CHANNEL_NAME);
}

function publishGeneration(payload: {
  projectId: string;
  status: "done" | "error";
  result?: GenerateBidResult;
  error?: string;
}) {
  try {
    generationChannel()?.postMessage(payload);
  } catch {
    /* ignore */
  }
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

function abortJob(projectId: string) {
  jobs.get(projectId)?.abort?.abort();
}

function finishJob(projectId: string, status: "done" | "error", result?: GenerateBidResult, error?: string) {
  const job = jobs.get(projectId);
  if (!job) return;
  job.status = status;
  if (result) job.result = result;
  if (error) job.error = error;
  notify();
}

function bidToGenerateResult(projectId: string, bid: { id: string; proposal_text?: string; bid_amount?: number | null; delivery_days?: number | null; questions?: string[]; model_used?: string | null }): GenerateBidResult {
  return {
    bid_id: bid.id,
    project_id: projectId,
    proposal: bid.proposal_text?.trim() ?? "",
    bid_amount: bid.bid_amount ?? null,
    delivery_days: bid.delivery_days ?? null,
    questions: bid.questions ?? [],
    model_used: bid.model_used ?? undefined,
  };
}

async function waitForSavedProposal(projectId: string, signal: AbortSignal): Promise<GenerateBidResult> {
  const deadline = Date.now() + 90_000;

  const fromChannel = new Promise<GenerateBidResult>((resolve, reject) => {
    const channel = generationChannel();
    if (!channel) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data as {
        projectId?: string;
        status?: string;
        result?: GenerateBidResult;
        error?: string;
      } | null;
      if (data?.projectId !== projectId) return;
      if (data.status === "done" && data.result) {
        channel.close();
        resolve(data.result);
        return;
      }
      if (data.status === "error") {
        channel.close();
        reject(new Error(data.error || "Proposal generation failed"));
      }
    };
    channel.addEventListener("message", onMessage);
    signal.addEventListener("abort", () => {
      channel.close();
      reject(new DOMException("Aborted", "AbortError"));
    });
  });

  const fromPoll = (async () => {
    while (!signal.aborted && Date.now() < deadline) {
      const res = await fetch(`/api/projects/${projectId}`, { cache: "no-store" });
      if (res.ok) {
        const detail = await res.json();
        const bids = Array.isArray(detail?.bids) ? detail.bids : [];
        const latest = [...bids].sort((a, b) => (b.version ?? 0) - (a.version ?? 0))[0];
        if (latest && (latest.proposal_text?.trim() || (latest.questions?.length ?? 0) > 0)) {
          return bidToGenerateResult(projectId, latest);
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    throw new Error(
      "Proposal generation timed out. Open the project tab — the API key or model may have failed.",
    );
  })();

  return Promise.race([fromChannel, fromPoll]);
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/** List badge while the other tab generates. Clears when the saved bid appears. */
export function markBackgroundGenerateOpen(projectId: string) {
  const existing = jobs.get(projectId);
  if (existing?.status === "done") return;
  if (existing?.kind === "generate" && existing.status === "generating") return;
  if (existing?.kind === "watch" && existing.status === "generating") return;

  abortJob(projectId);
  const startedAt = Date.now();
  const abort = new AbortController();
  const promise = waitForSavedProposal(projectId, abort.signal)
    .then((result) => {
      finishJob(projectId, "done", result);
      return result;
    })
    .catch((error) => {
      if (isAbortError(error)) {
        return Promise.reject(error);
      }
      const message = error instanceof Error ? error.message : "Could not generate proposal";
      finishJob(projectId, "error", undefined, message);
      return Promise.reject(error);
    });

  jobs.set(projectId, { status: "generating", kind: "watch", promise, startedAt, abort });
  notify();
  void promise.catch(() => {
    /* watch status is stored on the job */
  });
}

export function ensureProposalGeneration(project: Project): Promise<GenerateBidResult> {
  const existing = jobs.get(project.id);
  if (existing?.kind === "generate" && (existing.status === "generating" || existing.status === "done")) {
    return existing.promise;
  }
  if (existing?.status === "done" && existing.result) {
    return existing.promise;
  }

  abortJob(project.id);
  const startedAt = Date.now();
  const abort = new AbortController();
  const promise = generateBidClient(project)
    .then((result) => {
      finishJob(project.id, "done", result);
      publishGeneration({ projectId: project.id, status: "done", result });
      return result;
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : "Could not generate proposal";
      finishJob(project.id, "error", undefined, message);
      publishGeneration({ projectId: project.id, status: "error", error: message });
      throw error;
    });

  jobs.set(project.id, { status: "generating", kind: "generate", promise, startedAt, abort });
  notify();
  return promise;
}

export function regenerateProposalGeneration(
  project: Project,
  bidId: string,
): Promise<GenerateBidResult> {
  abortJob(project.id);
  jobs.delete(project.id);
  notify();

  const startedAt = Date.now();
  const abort = new AbortController();
  const promise = regenerateBidClient(bidId)
    .then((result) => {
      const job = jobs.get(project.id);
      if (job) {
        job.status = "done";
        job.result = result;
      }
      publishGeneration({ projectId: project.id, status: "done", result });
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
      publishGeneration({ projectId: project.id, status: "error", error: message });
      notify();
      throw error;
    });

  jobs.set(project.id, { status: "generating", kind: "generate", promise, startedAt, abort });
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
