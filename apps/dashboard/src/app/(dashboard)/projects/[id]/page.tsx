import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  ClientCountryCell,
  ClientRatingStars,
  ClientReviewCount,
} from "@/components/client-table-cells";
import { FreelancerProjectTitleLink } from "@/components/freelancer-project-title-link";
import { PageHeader } from "@/components/layout";
import { ProjectPanelsLayout } from "@/components/project-panels-layout";
import { clientCountryDisplay } from "@/lib/client-display";
import { freelancerProjectUrl } from "@/lib/freelancer-url";
import { safeReturnPath } from "@/lib/return-to";
import { getProject, getProfile, type Bid, type ClarificationEntry, type Project } from "@/lib/api";

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

function formatProjectSubtitle(project: Project, proposal: Bid | null): string {
  const budget = project.budget_text || "Budget not specified";
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
  proposal: Bid | null,
  displayName: string | null,
): string | null {
  const when = project.submitted_at ?? proposal?.created_at;
  if (!when && !displayName) return null;

  const name = displayName?.trim() || "You";
  if (!when) return `Submitted by ${name}`;

  const at = new Date(when).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `Submitted by ${name} · ${at}`;
}

function formatClarificationsCopy(entries: ClarificationEntry[] | undefined): string {
  if (!entries?.length) return "";
  return entries
    .map((entry) => {
      const who = entry.username ? `@${entry.username}` : entry.author;
      const meta = [who, entry.is_employer_reply ? "Employer" : null, entry.posted_at]
        .filter(Boolean)
        .join(" · ");
      return meta ? `${meta}\n${entry.text}` : entry.text;
    })
    .join("\n\n---\n\n");
}

function formatQuestionsCopy(questions: string[] | undefined): string {
  if (!questions?.length) return "";
  return questions.map((q, i) => `${i + 1}. ${q}`).join("\n");
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const backHref = safeReturnPath(sp.returnTo, "/submitted");
  const backLabel = backHref.startsWith("/find") ? "Back to find" : "Back to submitted";
  let data: Awaited<ReturnType<typeof getProject>>;
  let displayName: string | null = null;
  try {
    const [projectData, profileData] = await Promise.all([
      getProject(id),
      getProfile().catch(() => ({ profile: null })),
    ]);
    data = projectData;
    displayName = profileData.profile?.display_name ?? null;
  } catch {
    notFound();
  }

  const { project, bids } = data;
  const proposal = pickProposalBid(bids);
  const country = clientCountryDisplay(project.client_country);
  const submittedMeta = formatSubmittedMeta(project, proposal, displayName);
  const descriptionCopy = project.description?.trim() ?? "";
  const clarificationsCopy = formatClarificationsCopy(project.clarifications);
  const proposalCopy = proposal?.proposal_text?.trim() ?? "";
  const questionsCopy = formatQuestionsCopy(proposal?.questions);
  const showClient =
    country ||
    project.client_location ||
    project.client_rating != null ||
    project.client_review_count != null;
  const freelancerUrl = freelancerProjectUrl(project);

  return (
    <div className="-mb-[calc(2rem-10px)] flex h-[calc(100dvh-2rem-10px)] flex-col gap-3 overflow-hidden">
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
          (project.clarifications?.length ?? 0) === 0 ? (
            <p className="text-sm text-zinc-500">No clarification questions captured yet.</p>
          ) : (
            <div className="space-y-3">
              {project.clarifications!.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-xl border border-[var(--border)] bg-white/[0.02] p-4"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                    <span className="font-medium text-zinc-300">
                      {entry.author}
                      {entry.username ? ` @${entry.username}` : ""}
                    </span>
                    {entry.is_employer_reply && (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-400 ring-1 ring-emerald-500/20">
                        Employer
                      </span>
                    )}
                    {entry.posted_at && <span>{entry.posted_at}</span>}
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
                    {entry.text}
                  </p>
                </div>
              ))}
            </div>
          )
        }
        proposalCopy={proposalCopy}
        proposal={
          !proposal?.proposal_text?.trim() ? (
            <p className="text-sm text-zinc-500">No proposal captured yet.</p>
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
              {proposal.proposal_text}
            </p>
          )
        }
        questionsCopy={questionsCopy}
        questions={
          (proposal?.questions?.length ?? 0) === 0 ? (
            <p className="text-sm text-zinc-500">No questions captured yet.</p>
          ) : (
            <ul className="space-y-2 text-sm text-zinc-300">
              {proposal!.questions.map((q, i) => (
                <li key={i} className="leading-relaxed">
                  • {q}
                </li>
              ))}
            </ul>
          )
        }
      />
    </div>
  );
}
