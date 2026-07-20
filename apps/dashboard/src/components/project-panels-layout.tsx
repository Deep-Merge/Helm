"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CopyButton } from "@/components/copy-button";
import { ScrollPanel } from "@/components/project-panel";
import { SplitGroup } from "@/components/split-view";
import { useDashboardHotkeys } from "@/hooks/use-dashboard-hotkeys";
import { copyToClipboard } from "@/lib/copy-to-clipboard";

function InnerBidBox({
  title,
  copyText,
  headerAction,
  children,
  className = "",
  scroll = true,
  fillContent = false,
}: {
  title?: string;
  copyText?: string;
  headerAction?: ReactNode;
  children: ReactNode;
  className?: string;
  scroll?: boolean;
  fillContent?: boolean;
}) {
  return (
    <div
      className={`flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/[0.07] bg-black/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] ${className}`}
    >
      {title ? (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-2.5">
          <h3 className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">{title}</h3>
          <div className="flex items-center gap-1.5">
            {headerAction}
            {copyText !== undefined ? (
              <CopyButton text={copyText} label={`Copy ${title?.toLowerCase() ?? "content"}`} />
            ) : null}
          </div>
        </div>
      ) : null}
      <div
        className={
          fillContent
            ? "flex min-h-0 flex-1 flex-col overflow-hidden"
            : scroll
              ? "min-h-0 flex-1 overflow-y-auto px-4 py-3.5"
              : "px-4 py-3.5"
        }
      >
        {children}
      </div>
    </div>
  );
}

function RegenerateIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden>
      <path
        d="M13.5 8a5.5 5.5 0 0 1-9.2 4M2.5 8a5.5 5.5 0 0 1 9.2-4"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
      <path
        d="M2.5 4.5V8h3.5M13.5 11.5V8H10"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BidWorkspacePanel({
  bidEstimates,
  proposalCopy,
  proposal,
  proposalFill = false,
  questionsCopy,
  questions,
  questionsFill = false,
  onRegenerate,
  regenerating = false,
  regenerateDisabled = false,
}: {
  bidEstimates?: ReactNode;
  proposalCopy: string;
  proposal: ReactNode;
  proposalFill?: boolean;
  questionsCopy: string;
  questions: ReactNode;
  questionsFill?: boolean;
  onRegenerate?: () => void;
  regenerating?: boolean;
  regenerateDisabled?: boolean;
}) {
  const regenerateButton = onRegenerate ? (
    <button
      type="button"
      onClick={onRegenerate}
      disabled={regenerateDisabled || regenerating}
      title="Regenerate proposal, questions, bid price, and timeline"
      className="inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-zinc-400 transition hover:bg-indigo-500/15 hover:text-indigo-200 disabled:pointer-events-none disabled:opacity-40"
    >
      {regenerating ? (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-400/30 border-t-indigo-400" />
      ) : (
        <RegenerateIcon />
      )}
      Regenerate
    </button>
  ) : null;

  return (
    <section className="glass flex h-full min-h-0 flex-col overflow-hidden rounded-2xl">
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 p-3">
        {bidEstimates ? (
          <InnerBidBox scroll={false} className="shrink-0">
            {bidEstimates}
          </InnerBidBox>
        ) : null}

        <InnerBidBox
          title="My proposal"
          copyText={proposalCopy}
          headerAction={regenerateButton}
          className="min-h-0 flex-[3]"
          fillContent={proposalFill}
        >
          {proposal}
        </InnerBidBox>

        <InnerBidBox
          title="My questions"
          copyText={questionsCopy}
          className="min-h-0 flex-[2]"
          fillContent={questionsFill}
        >
          {questions}
        </InnerBidBox>
      </div>
    </section>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden>
      <path
        d="M13.5 8a5.5 5.5 0 0 1-9.2 4M2.5 8a5.5 5.5 0 0 1 9.2-4"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
      <path
        d="M2.5 4.5V8h3.5M13.5 11.5V8H10"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ClarificationRefreshButton({
  onRefresh,
  refreshing,
}: {
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  if (!onRefresh) return null;
  return (
    <button
      type="button"
      onClick={onRefresh}
      disabled={refreshing}
      title="Scrape all Q&A from Freelancer (expands hidden posts)"
      className="inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-zinc-400 transition hover:bg-indigo-500/15 hover:text-indigo-200 disabled:pointer-events-none disabled:opacity-40"
    >
      {refreshing ? (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-400/30 border-t-indigo-400" />
      ) : (
        <RefreshIcon />
      )}
      Refresh
    </button>
  );
}

export function ProjectPanelsLayout({
  descriptionCopy,
  description,
  clarificationsCopy,
  clarifications,
  onRefreshClarifications,
  refreshingClarifications,
  bidEstimates,
  proposalCopy,
  proposal,
  proposalFill = false,
  questionsCopy,
  questions,
  questionsFill = false,
  onRegenerate,
  regenerating,
  regenerateDisabled,
}: {
  descriptionCopy: string;
  description: ReactNode;
  clarificationsCopy: string;
  clarifications: ReactNode;
  onRefreshClarifications?: () => void;
  refreshingClarifications?: boolean;
  bidEstimates?: ReactNode;
  proposalCopy: string;
  proposal: ReactNode;
  proposalFill?: boolean;
  questionsCopy: string;
  questions: ReactNode;
  questionsFill?: boolean;
  onRegenerate?: () => void;
  regenerating?: boolean;
  regenerateDisabled?: boolean;
}) {
  const proposalCopyRef = useRef(proposalCopy);
  const questionsCopyRef = useRef(questionsCopy);
  proposalCopyRef.current = proposalCopy;
  questionsCopyRef.current = questionsCopy;

  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);

  const showCopyFeedback = useCallback((message: string) => {
    setCopyFeedback(message);
    if (feedbackTimerRef.current != null) {
      window.clearTimeout(feedbackTimerRef.current);
    }
    feedbackTimerRef.current = window.setTimeout(() => {
      setCopyFeedback(null);
      feedbackTimerRef.current = null;
    }, 1600);
  }, []);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current != null) {
        window.clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  const copyProposal = useCallback(async () => {
    const copied = await copyToClipboard(proposalCopyRef.current);
    showCopyFeedback(copied ? "Proposal copied" : "Nothing to copy");
  }, [showCopyFeedback]);

  const copyQuestions = useCallback(async () => {
    const copied = await copyToClipboard(questionsCopyRef.current);
    showCopyFeedback(copied ? "Questions copied" : "Nothing to copy");
  }, [showCopyFeedback]);

  useDashboardHotkeys({
    onCopyProposal: () => void copyProposal(),
    onCopyQuestions: () => void copyQuestions(),
  });

  return (
    <div className="min-h-0 flex-1">
      <SplitGroup direction="horizontal" defaultRatios={[60, 40]} className="h-full">
        <SplitGroup direction="vertical" defaultRatios={[70, 30]} className="h-full w-full min-h-0">
          <ScrollPanel title="Description" copyText={descriptionCopy} className="h-full min-h-0">
            {description}
          </ScrollPanel>
          <ScrollPanel
            title="Clarification board"
            copyText={clarificationsCopy}
            headerAction={
              <ClarificationRefreshButton
                onRefresh={onRefreshClarifications}
                refreshing={refreshingClarifications}
              />
            }
            className="h-full min-h-0"
          >
            {clarifications}
          </ScrollPanel>
        </SplitGroup>

        <BidWorkspacePanel
          bidEstimates={bidEstimates}
          proposalCopy={proposalCopy}
          proposal={proposal}
          proposalFill={proposalFill}
          questionsCopy={questionsCopy}
          questions={questions}
          questionsFill={questionsFill}
          onRegenerate={onRegenerate}
          regenerating={regenerating}
          regenerateDisabled={regenerateDisabled}
        />
      </SplitGroup>

      {copyFeedback ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-100 shadow-lg backdrop-blur-sm"
        >
          {copyFeedback}
        </div>
      ) : null}
    </div>
  );
}
