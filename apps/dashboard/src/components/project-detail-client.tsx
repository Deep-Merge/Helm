"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  ClientCountryCell,
  ClientRatingStars,
  ClientReviewCount,
} from "@/components/client-table-cells";
import { FreelancerProjectTitleLink } from "@/components/freelancer-project-title-link";
import { PageHeader } from "@/components/layout";
import { ProjectDetailPanels } from "@/components/project-detail-panels";
import { ProposalGeneratingTopBar } from "@/components/proposal-generating-progress";
import { ToggleSubmittedButton } from "@/components/toggle-submitted-button";
import { useProposalGeneration } from "@/hooks/use-proposal-generation";
import { clientCountryDisplay } from "@/lib/client-display";
import { freelancerProjectUrl } from "@/lib/freelancer-url";
import { formatProjectBudgetText } from "@/lib/project-budget";
import type { Bid, Project } from "@/lib/api";

function ClientSummaryLine({ project }: { project: Project }) {
  const country = clientCountryDisplay(project.client_country);
  const items: { key: string; node: ReactNode }[] = [];

  if (project.client_location) {
    items.push({ key: "location", node: <span className="text-zinc-400">{project.client_location}</span> });
  }
  if (country) {
    items.push({
      key: "country",
      node: (
        <ClientCountryCell
          country={project.client_country}
          countryFlag={project.client_country_flag}
        />
      ),
    });
  }
  if (project.client_rating != null) {
    items.push({ key: "rating", node: <ClientRatingStars rating={project.client_rating} /> });
  }
  if (project.client_review_count != null) {
    items.push({ key: "reviews", node: <ClientReviewCount count={project.client_review_count} /> });
  }

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      {items.map((item, i) => (
        <span key={item.key} className="inline-flex items-center gap-2">
          {i > 0 && <span className="text-zinc-600" aria-hidden>·</span>}
          {item.node}
        </span>
      ))}
    </div>
  );
}

function pickProposalBid(bids: Bid[]): Bid | null {
  if (bids.length === 0) return null;
  return bids.find((b) => b.status === "submitted") ?? bids[0];
}

const SUBMITTED_STATUSES = new Set(["submitted", "won", "lost"]);

function formatProjectSubtitle(project: Project, proposal: Bid | null): string {
  const budget = formatProjectBudgetText(project) || "Budget not specified";
  if (!SUBMITTED_STATUSES.has(project.status)) return budget;

  const details: string[] = [];
  const amount = project.submitted_bid_amount ?? proposal?.bid_amount;
  const days = project.submitted_delivery_days ?? proposal?.delivery_days;

  if (amount != null) {
    const bidSuffix = project.budget_type === "hourly" ? " /hr" : "";
    details.push(`Your bid: $${amount.toLocaleString()}${bidSuffix}`);
  }
  if (days != null) {
    details.push(`${days} days`);
  }

  if (details.length === 0) return budget;
  return `${budget} · ${details.join(" · ")}`;
}

function formatSubmittedMeta(
  project: Project,
  displayName: string | null,
): string | null {
  if (!SUBMITTED_STATUSES.has(project.status) || !project.submitted_at) return null;

  const name = displayName?.trim() || "You";
  const at = new Date(project.submitted_at).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `Submitted by ${name} · ${at}`;
}

export function ProjectDetailClient({
  project: initialProject,
  initialBids,
  displayName,
  backHref,
  backLabel,
  generateOnOpen = false,
}: {
  project: Project;
  initialBids: Bid[];
  displayName: string | null;
  backHref: string;
  backLabel: string;
  generateOnOpen?: boolean;
}) {
  const [project, setProject] = useState(initialProject);
  const { isGenerating, progress } = useProposalGeneration(project.id);

  useEffect(() => {
    setProject(initialProject);
  }, [initialProject]);

  const proposal = pickProposalBid(initialBids);
  const country = clientCountryDisplay(project.client_country);
  const submittedMeta = formatSubmittedMeta(project, displayName);
  const showClient =
    country ||
    project.client_location ||
    project.client_rating != null ||
    project.client_review_count != null;
  const freelancerUrl = freelancerProjectUrl(project);

  const handleToggled = useCallback(
    (_projectId: string, status: "viewed" | "submitted") => {
      setProject((current) => ({
        ...current,
        status,
        submitted_at:
          status === "submitted"
            ? current.submitted_at ?? new Date().toISOString()
            : null,
      }));
    },
    [],
  );

  return (
    <>
      <div className="shrink-0 space-y-3">
        <Link
          href={backHref}
          scroll={false}
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition hover:text-indigo-300"
        >
          <span aria-hidden>←</span>
          {backLabel}
        </Link>

        <PageHeader
          className="!mb-0"
          title={project.title}
          titleElement={
            freelancerUrl ? (
              <FreelancerProjectTitleLink
                project={project}
                className="transition hover:text-indigo-300"
              />
            ) : undefined
          }
          description={formatProjectSubtitle(project, proposal)}
          action={
            <ToggleSubmittedButton
              variant="pill"
              project={project}
              onToggled={handleToggled}
            />
          }
          summary={
            showClient || submittedMeta ? (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                {showClient ? <ClientSummaryLine project={project} /> : null}
                {showClient && submittedMeta ? (
                  <span className="text-zinc-600" aria-hidden>
                    ·
                  </span>
                ) : null}
                {submittedMeta ? (
                  <span className="whitespace-nowrap text-zinc-500">{submittedMeta}</span>
                ) : null}
              </div>
            ) : undefined
          }
        />
      </div>

      {isGenerating ? (
        <div className="shrink-0 space-y-1.5 rounded-xl border border-violet-400/25 bg-violet-500/[0.08] px-4 py-3 ring-1 ring-violet-400/20">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-violet-100">{progress.label}</p>
            <p className="text-xs tabular-nums text-violet-300/80">
              {Math.round(progress.percent)}%
            </p>
          </div>
          <ProposalGeneratingTopBar percent={progress.percent} />
        </div>
      ) : null}

      <ProjectDetailPanels
        project={project}
        initialBids={initialBids}
        generateOnOpen={generateOnOpen}
      />
    </>
  );
}
