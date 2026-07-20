"use client";

import { useRouter } from "next/navigation";
import {
  ClientCountryCell,
  ClientRatingStars,
  ClientReviewCount,
} from "@/components/client-table-cells";
import { formatBudgetTypeLabel } from "@/components/filter-field";
import { formatProjectBudgetText } from "@/lib/project-budget";
import { CopyProjectUrlButton } from "@/components/copy-project-url-button";
import { DeleteProjectButton } from "@/components/delete-project-button";
import { OpenProjectButton } from "@/components/open-project-button";
import { RelativeTime } from "@/components/relative-time";
import { useDiscoverMonitor } from "@/components/discover-monitor";
import type { Project } from "@/lib/api";
import { formatSubmittedDayHeading, localDayFromIso } from "@/lib/date-range";
import { markProjectAsSeen } from "@/lib/mark-project-seen";
import { openProjectDetailInNewTab } from "@/lib/open-project-detail";
import { openFreelancerInNewTab, isBackgroundOpenModifier } from "@/lib/open-freelancer";
import { cacheProject } from "@/lib/project-cache";
import { withReturnTo } from "@/lib/return-to";

function formatBid(amount: number | null | undefined, budgetType?: string) {
  if (amount == null) return "—";
  const suffix = budgetType === "hourly" ? "/hr" : "";
  return `$${amount.toLocaleString()}${suffix}`;
}

function outcomeLabel(status: string): string | null {
  if (status === "won") return "Won";
  if (status === "lost") return "Lost";
  return null;
}

function BudgetTypePill({ budgetType }: { budgetType?: string | null }) {
  const label = formatBudgetTypeLabel(budgetType);
  if (!label) return null;

  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
        budgetType === "hourly"
          ? "bg-violet-500/15 text-violet-200 ring-violet-400/30"
          : "bg-sky-500/15 text-sky-200 ring-sky-400/30"
      }`}
    >
      {label}
    </span>
  );
}

function groupBySubmittedDay(projects: Project[]) {
  const byDay = new Map<string, Project[]>();

  for (const project of projects) {
    const day = localDayFromIso(project.submitted_at);
    if (!day) continue;
    const list = byDay.get(day) ?? [];
    list.push(project);
    byDay.set(day, list);
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([day, dayProjects]) => ({
      day,
      heading: formatSubmittedDayHeading(day),
      projects: dayProjects.sort((a, b) => {
        const ta = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
        const tb = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
        return tb - ta;
      }),
    }));
}

function SubmittedProjectCard({
  project,
  returnTo,
  markProjectSeen,
  confirmProjectSeenOnServer,
}: {
  project: Project;
  returnTo?: string;
  markProjectSeen: (id: string) => void;
  confirmProjectSeenOnServer: (id: string) => void;
}) {
  const router = useRouter();
  const detailHref = returnTo
    ? withReturnTo(`/projects/${project.id}`, returnTo)
    : `/projects/${project.id}`;
  const outcome = outcomeLabel(project.status);

  function openDetails(event?: React.MouseEvent | React.KeyboardEvent) {
    cacheProject(project);
    markProjectAsSeen(project, markProjectSeen, confirmProjectSeenOnServer, { skipServer: true });
    if (event && isBackgroundOpenModifier(event)) {
      event.preventDefault();
      openProjectDetailInNewTab(detailHref, { background: true });
      return;
    }
    router.push(detailHref);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(event) => openDetails(event)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openDetails(event);
        }
      }}
      className="group block cursor-pointer rounded-xl outline-none ring-1 ring-emerald-400/35 ring-offset-1 ring-offset-[#09090b] transition hover:ring-emerald-300/55 focus-visible:ring-emerald-300/70"
    >
      <article className="relative overflow-hidden rounded-xl border border-emerald-400/40 bg-gradient-to-br from-emerald-500/[0.1] via-[#0c1210] to-teal-500/[0.05] px-4 py-3 pl-5">
        <div
          className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-emerald-300 to-teal-500"
          aria-hidden
        />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              {outcome && (
                <span
                  className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${
                    project.status === "won"
                      ? "bg-amber-500/15 text-amber-200 ring-amber-400/35"
                      : "bg-zinc-500/15 text-zinc-300 ring-zinc-400/25"
                  }`}
                >
                  {outcome}
                </span>
              )}
              <BudgetTypePill budgetType={project.budget_type} />
            </div>
            <h3 className="truncate text-base font-semibold text-emerald-50 group-hover:text-white">
              {project.title}
            </h3>
            {(() => {
              const budgetText = formatProjectBudgetText(project);
              return budgetText ? (
                <p className="mt-0.5 truncate text-xs text-emerald-200/60">{budgetText}</p>
              ) : null;
            })()}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-lg font-bold tabular-nums text-emerald-50">
              {formatBid(project.submitted_bid_amount, project.budget_type)}
            </p>
            {project.submitted_delivery_days != null && (
              <p className="text-[11px] text-emerald-200/60">{project.submitted_delivery_days}d</p>
            )}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-emerald-400/20 pt-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <ClientCountryCell
              country={project.client_country}
              countryFlag={project.client_country_flag}
              size="sm"
            />
            <ClientRatingStars rating={project.client_rating} size="sm" />
            <ClientReviewCount count={project.client_review_count} size="sm" />
            <RelativeTime
              value={project.submitted_at}
              titlePrefix="Submitted"
              className="text-[11px] text-emerald-200/50"
            />
          </div>
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <OpenProjectButton
              size="sm"
              className="!bg-emerald-500/15 !text-emerald-100 !ring-emerald-400/30 hover:!bg-emerald-500/25"
              onClick={(event) => {
                markProjectAsSeen(project, markProjectSeen, confirmProjectSeenOnServer, { skipServer: true });
                openFreelancerInNewTab(project, { background: isBackgroundOpenModifier(event) });
              }}
            />
            <CopyProjectUrlButton project={project} />
            <DeleteProjectButton
              projectId={project.id}
              projectTitle={project.title}
              onDeleted={() => router.refresh()}
            />
          </div>
        </div>
      </article>
    </div>
  );
}

export function SubmittedProjectCards({
  projects,
  returnTo,
  searchQuery = "",
  dayCounts,
}: {
  projects: Project[];
  returnTo?: string;
  searchQuery?: string;
  dayCounts?: Record<string, number>;
}) {
  const { markProjectSeen, confirmProjectSeenOnServer } = useDiscoverMonitor();
  const groups = groupBySubmittedDay(projects);

  if (projects.length === 0) {
    const hasSearch = searchQuery.length > 0;
    return (
      <div className="glass flex flex-col items-center justify-center rounded-xl py-12 text-center">
        <p className="text-base font-medium text-zinc-300">
          {hasSearch ? "No projects match your search" : "No submitted projects in this range"}
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          {hasSearch
            ? "Try a different name or clear the search box."
            : "Try a wider date range or place bids on Freelancer."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <section key={group.day}>
          <div className="mb-3 inline-flex w-auto max-w-full flex-wrap items-center gap-x-2.5 gap-y-1 rounded-xl border border-indigo-400/40 bg-gradient-to-r from-indigo-500/20 via-violet-500/12 to-indigo-500/8 px-4 py-3 shadow-[0_0_28px_-10px_rgba(99,102,241,0.45)] ring-1 ring-indigo-400/30">
            <h2 className="text-base font-semibold tracking-tight text-indigo-50">
              {group.heading.title}
            </h2>
            <span className="text-sm font-medium tabular-nums text-indigo-200/90">
              {group.heading.date}
            </span>
            <span className="rounded-full bg-amber-500/25 px-2.5 py-0.5 text-xs font-bold tabular-nums text-amber-50 ring-1 ring-amber-400/55">
              {dayCounts?.[group.day] ?? group.projects.length} submitted
            </span>
          </div>
          <div className="space-y-2">
            {group.projects.map((project) => (
              <SubmittedProjectCard
                key={project.id}
                project={project}
                returnTo={returnTo}
                markProjectSeen={markProjectSeen}
                confirmProjectSeenOnServer={confirmProjectSeenOnServer}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
