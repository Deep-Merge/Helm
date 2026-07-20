"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Bid, ClarificationEntry, Project } from "@/lib/api";
import { refreshClarificationsViaExtension } from "@/lib/clarifications-client";
import { formatClarificationsCopy, groupClarificationThreads } from "@/lib/clarifications-display";
import type { GenerateBidResult } from "@/lib/bids-client";
import { updateBidClient } from "@/lib/bids-client";
import { PremiumNumberInput } from "@/components/premium-number-input";
import { ProjectPanelsLayout } from "@/components/project-panels-layout";
import { ProposalGeneratingPanel } from "@/components/proposal-generating-progress";
import { useProposalGeneration } from "@/hooks/use-proposal-generation";
import {
  ensureProposalGeneration,
  regenerateProposalGeneration,
} from "@/lib/proposal-generation-store";

function pickLatestBid(bids: Bid[]): Bid | null {
  if (bids.length === 0) return null;
  return [...bids].sort((a, b) => b.version - a.version)[0];
}

function hasSavedBidContent(bids: Bid[]): boolean {
  const latest = pickLatestBid(bids);
  if (!latest) return false;
  return Boolean(latest.proposal_text?.trim()) || (latest.questions?.length ?? 0) > 0;
}

function formatQuestionsCopy(questions: string[]): string {
  if (!questions.length) return "";
  return questions.map((q, i) => `${i + 1}. ${q}`).join("\n");
}

function parseQuestionsText(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean);
}

function EditableBidTextarea({
  value,
  onChange,
  onBlur,
  disabled,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="relative min-h-0 flex-1">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        disabled={disabled}
        placeholder={placeholder}
        className="absolute inset-0 h-full w-full resize-none border-0 bg-transparent px-4 py-3.5 text-sm leading-relaxed text-zinc-300 outline-none ring-0 placeholder:text-zinc-600 focus:ring-0 disabled:cursor-default disabled:opacity-60"
      />
    </div>
  );
}

function ClarificationMessage({ entry }: { entry: ClarificationEntry }) {
  const depth = entry.depth ?? 0;
  const isClient = entry.is_employer_reply;

  return (
    <div
      className={depth > 0 ? "ml-4 border-l border-zinc-700/60 pl-4 sm:ml-6" : ""}
    >
      <div
        className={`rounded-lg border px-3.5 py-3 ${
          isClient
            ? "border-emerald-500/15 bg-emerald-500/[0.04]"
            : "border-indigo-500/15 bg-indigo-500/[0.04]"
        }`}
      >
        <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-semibold text-zinc-100">{entry.author}</span>
          {entry.posted_at ? (
            <span className="text-xs text-zinc-500">{entry.posted_at}</span>
          ) : null}
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{entry.text}</p>
      </div>
    </div>
  );
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

const LOCKED_STATUSES = new Set(["submitted", "won", "lost"]);

function ClarificationsBoard({
  entries,
  loading,
  error,
}: {
  entries: ClarificationEntry[];
  loading?: boolean;
  error?: string | null;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-3 py-6 text-sm text-zinc-400">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-indigo-400/30 border-t-indigo-400" />
        Scraping clarification board in the background…
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-400">{error}</p>;
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No clarification questions captured yet. Click Refresh to scrape from Freelancer.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {groupClarificationThreads(entries).map((thread) => (
        <div
          key={thread[0]?.thread_id ?? thread[0]?.id}
          className="space-y-3 rounded-xl border border-[var(--border)] bg-white/[0.02] p-4"
        >
          {thread.map((entry) => (
            <ClarificationMessage key={entry.id} entry={entry} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ProjectDetailPanels({
  project,
  initialBids,
  generateOnOpen = false,
}: {
  project: Project;
  initialBids: Bid[];
  generateOnOpen?: boolean;
}) {
  const isLocked = LOCKED_STATUSES.has(project.status);
  const initial = pickLatestBid(initialBids);

  const [bidId, setBidId] = useState<string | null>(initial?.id ?? null);
  const [bidAmount, setBidAmount] = useState(
    () => String(project.submitted_bid_amount ?? initial?.bid_amount ?? ""),
  );
  const [deliveryDays, setDeliveryDays] = useState(
    () => String(project.submitted_delivery_days ?? initial?.delivery_days ?? ""),
  );
  const [proposal, setProposal] = useState(initial?.proposal_text?.trim() ?? "");
  const [questions, setQuestions] = useState<string[]>(initial?.questions ?? []);
  const [questionsDraft, setQuestionsDraft] = useState(() => (initial?.questions ?? []).join("\n"));
  const [clarifications, setClarifications] = useState<ClarificationEntry[]>(
    project.clarifications ?? [],
  );
  const [refreshingClarifications, setRefreshingClarifications] = useState(false);
  const [clarificationsError, setClarificationsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { isGenerating, progress } = useProposalGeneration(project.id);
  const bidIdRef = useRef<string | null>(initial?.id ?? null);

  const applyGenerateResult = useCallback((result: GenerateBidResult) => {
    bidIdRef.current = result.bid_id;
    setBidId(result.bid_id);
    setBidAmount(result.bid_amount != null ? String(result.bid_amount) : "");
    setDeliveryDays(result.delivery_days != null ? String(result.delivery_days) : "");
    setProposal(result.proposal);
    setQuestions(result.questions ?? []);
    setQuestionsDraft((result.questions ?? []).join("\n"));
  }, []);

  const runGenerate = useCallback(
    async (regenerate = false) => {
      setError(null);
      try {
        const currentBidId = bidIdRef.current;
        const result =
          regenerate && currentBidId
            ? await regenerateProposalGeneration(project, currentBidId)
            : await ensureProposalGeneration(project);
        applyGenerateResult(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not generate proposal");
      }
    },
    [applyGenerateResult, project],
  );

  const handleRegenerate = useCallback(() => {
    void runGenerate(true);
  }, [runGenerate]);

  const handleRefreshClarifications = useCallback(() => {
    void (async () => {
      setRefreshingClarifications(true);
      setClarificationsError(null);
      try {
        const entries = await refreshClarificationsViaExtension(project);
        setClarifications(entries);
      } catch (e) {
        setClarificationsError(
          e instanceof Error ? e.message : "Could not refresh clarification board",
        );
      } finally {
        setRefreshingClarifications(false);
      }
    })();
  }, [project]);

  const persistBid = useCallback(
    async (patch: {
      bid_amount?: number | null;
      delivery_days?: number | null;
      proposal_text?: string;
      questions?: string[];
    }) => {
      if (!bidId || isLocked) return;
      try {
        await updateBidClient(bidId, patch);
      } catch {
        /* ignore save errors for now */
      }
    },
    [bidId, isLocked],
  );

  const handleProposalBlur = useCallback(() => {
    void persistBid({ proposal_text: proposal.trim() });
  }, [persistBid, proposal]);

  const handleQuestionsBlur = useCallback(() => {
    const parsed = parseQuestionsText(questionsDraft);
    setQuestions(parsed);
    setQuestionsDraft(parsed.join("\n"));
    void persistBid({ questions: parsed });
  }, [persistBid, questionsDraft]);

  useEffect(() => {
    setClarifications(project.clarifications ?? []);
  }, [project.clarifications]);

  useEffect(() => {
    const bid = pickLatestBid(initialBids);
    bidIdRef.current = bid?.id ?? null;
    setBidId(bid?.id ?? null);
    setBidAmount(String(project.submitted_bid_amount ?? bid?.bid_amount ?? ""));
    setDeliveryDays(String(project.submitted_delivery_days ?? bid?.delivery_days ?? ""));
    setProposal(bid?.proposal_text?.trim() ?? "");
    setQuestions(bid?.questions ?? []);
    setQuestionsDraft((bid?.questions ?? []).join("\n"));
  }, [
    project.id,
    initialBids,
    project.submitted_bid_amount,
    project.submitted_delivery_days,
  ]);

  useEffect(() => {
    if (!generateOnOpen || isLocked || hasSavedBidContent(initialBids)) return;

    let cancelled = false;
    void ensureProposalGeneration(project)
      .then((result) => {
        if (!cancelled) {
          applyGenerateResult(result);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not generate proposal");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [generateOnOpen, project.id, isLocked, initialBids, applyGenerateResult, project]);

  const isHourly = project.budget_type === "hourly";
  const bidLabel = isHourly ? "My bid price ($/hr)" : "My bid price ($)";

  const bidEstimates = (
    <div className="grid grid-cols-2 gap-3">
      <PremiumNumberInput
        label={bidLabel}
        value={bidAmount}
        min={0}
        step={1}
        disabled={isGenerating || isLocked}
        onChange={setBidAmount}
        onBlur={() => void persistBid({ bid_amount: parseOptionalNumber(bidAmount) })}
      />
      <PremiumNumberInput
        label="Timeline (days)"
        value={deliveryDays}
        min={1}
        step={1}
        disabled={isGenerating || isLocked}
        onChange={setDeliveryDays}
        onBlur={() => void persistBid({ delivery_days: parseOptionalNumber(deliveryDays) })}
      />
    </div>
  );

  const descriptionCopy = project.description?.trim() ?? "";
  const clarificationsCopy = formatClarificationsCopy(clarifications);
  const proposalCopy = proposal.trim();
  const questionsForCopy = isLocked ? questions : parseQuestionsText(questionsDraft);
  const questionsCopy = formatQuestionsCopy(questionsForCopy);

  return (
    <ProjectPanelsLayout
      descriptionCopy={descriptionCopy}
      description={
        <>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
            {project.description || "No description captured."}
          </p>
          {(project.skills?.length ?? 0) > 0 && (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
              {project.skills.map((skill) => (
                <span
                  key={skill}
                  className="rounded-lg bg-white/[0.04] px-2.5 py-1 text-xs text-zinc-300 ring-1 ring-white/10"
                >
                  {skill}
                </span>
              ))}
            </div>
          )}
        </>
      }
      clarificationsCopy={clarificationsCopy}
      clarifications={
        <ClarificationsBoard
          entries={clarifications}
          loading={refreshingClarifications}
          error={clarificationsError}
        />
      }
      onRefreshClarifications={handleRefreshClarifications}
      refreshingClarifications={refreshingClarifications}
      bidEstimates={bidEstimates}
      proposalCopy={proposalCopy}
      proposalFill={!isLocked && !isGenerating && !error}
      proposal={
        isGenerating ? (
          <ProposalGeneratingPanel label={progress.label} percent={progress.percent} />
        ) : error ? (
          <div className="space-y-3">
            <p className="text-sm text-red-400">{error}</p>
            {!isLocked ? (
              <button
                type="button"
                onClick={handleRegenerate}
                disabled={isGenerating}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-500/15 px-3 py-1.5 text-xs font-medium text-indigo-200 ring-1 ring-indigo-400/30 transition hover:bg-indigo-500/25 disabled:opacity-50"
              >
                Try again
              </button>
            ) : null}
          </div>
        ) : isLocked ? (
          !proposal ? (
            <p className="text-sm text-zinc-500">No proposal yet.</p>
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{proposal}</p>
          )
        ) : (
          <EditableBidTextarea
            value={proposal}
            onChange={setProposal}
            onBlur={handleProposalBlur}
            disabled={!bidId}
            placeholder="Proposal will appear here after generation, or type your own…"
          />
        )
      }
      questionsCopy={questionsCopy}
      questionsFill={!isLocked && !isGenerating}
      questions={
        isGenerating ? (
          <p className="text-sm text-zinc-500">Generating with your proposal…</p>
        ) : isLocked ? (
          questions.length === 0 ? (
            <p className="text-sm text-zinc-500">No questions yet.</p>
          ) : (
            <ul className="space-y-2 text-sm text-zinc-300">
              {questions.map((q, i) => (
                <li key={i} className="leading-relaxed">
                  • {q}
                </li>
              ))}
            </ul>
          )
        ) : (
          <EditableBidTextarea
            value={questionsDraft}
            onChange={setQuestionsDraft}
            onBlur={handleQuestionsBlur}
            disabled={!bidId}
            placeholder="One question per line…"
          />
        )
      }
      onRegenerate={handleRegenerate}
      regenerating={isGenerating}
      regenerateDisabled={isGenerating}
    />
  );
}
