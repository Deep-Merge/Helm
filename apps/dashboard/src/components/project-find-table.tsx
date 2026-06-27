"use client";

import { useRouter } from "next/navigation";
import {
  ClientCountryCell,
  ClientRatingStars,
  ClientReviewCount,
} from "@/components/client-table-cells";
import { CopyProjectUrlButton } from "@/components/copy-project-url-button";
import { DeleteProjectButton } from "@/components/delete-project-button";
import { ToggleSubmittedButton } from "@/components/toggle-submitted-button";
import { useDiscoverMonitor } from "@/components/discover-monitor";
import { ProjectStatusBadge } from "@/components/project-status-badge";
import { RelativeTime } from "@/components/relative-time";
import type { Project } from "@/lib/api";
import { saveFindScrollRestore } from "@/lib/find-scroll-restore";
import { markProjectAsSeen } from "@/lib/mark-project-seen";
import { openFreelancerFromClick, isBackgroundOpenModifier } from "@/lib/open-freelancer";
import { pipelineStatus } from "@/lib/project-status";
import { projectPostedAt } from "@/lib/relative-time";
import { withReturnTo } from "@/lib/return-to";

function formatAvgBid(project: Project): string {
  if (project.bid_avg == null) return "—";
  const sign = project.bid_currency_sign || "$";
  const amount = Number(project.bid_avg);
  const formatted = Number.isInteger(amount) ? amount.toLocaleString() : amount.toFixed(0);
  const suffix = project.budget_type === "hourly" ? "/hr" : "";
  return `${sign}${formatted}${suffix}`;
}

function formatSubmittedBid(project: Project): string {
  if (project.submitted_bid_amount == null) return "—";
  const suffix = project.budget_type === "hourly" ? "/hr" : "";
  return `$${project.submitted_bid_amount.toLocaleString()}${suffix}`;
}

function rowHighlightClass(status: string): string {
  const pipeline = pipelineStatus(status);
  if (pipeline === "new") {
    return "border-l-2 border-l-indigo-400/90 bg-indigo-500/[0.06] hover:bg-indigo-500/[0.1]";
  }
  if (pipeline === "submitted") {
    return "border-l-2 border-l-emerald-400/70 bg-emerald-500/[0.05] hover:bg-emerald-500/[0.09]";
  }
  return "hover:bg-white/[0.03]";
}

export function ProjectFindTable({
  projects,
  returnTo,
}: {
  projects: Project[];
  returnTo?: string;
}) {
  const router = useRouter();
  const { markProjectSeen, confirmProjectSeenOnServer, removeProject, setProjectStatus } =
    useDiscoverMonitor();

  if (projects.length === 0) {
    return (
      <div className="glass flex flex-col items-center justify-center rounded-2xl py-16 text-center">
        <p className="text-xl font-medium text-zinc-300">No projects yet</p>
        <p className="mt-2 max-w-sm text-base text-zinc-500">
          Try different filters or search Freelancer for more projects.
        </p>
      </div>
    );
  }

  return (
    <div className="glass overflow-x-auto rounded-2xl">
      <table className="w-full min-w-[1200px] text-left text-sm">
        <thead>
          <tr className="border-b border-white/[0.08] text-[11px] uppercase tracking-wider text-zinc-500">
            <th className="px-3 py-2.5 font-medium">Status</th>
            <th className="min-w-[220px] px-3 py-2.5 font-medium">Project</th>
            <th className="px-3 py-2.5 font-medium">Budget</th>
            <th className="px-3 py-2.5 font-medium">Bids</th>
            <th className="px-3 py-2.5 font-medium">Avg bid</th>
            <th className="px-3 py-2.5 font-medium">Country</th>
            <th className="px-3 py-2.5 font-medium">Rating</th>
            <th className="px-3 py-2.5 font-medium">Reviews</th>
            <th className="min-w-[160px] px-3 py-2.5 font-medium">Skills</th>
            <th className="px-3 py-2.5 font-medium">Risk</th>
            <th className="px-3 py-2.5 font-medium">Time</th>
            <th className="px-3 py-2.5 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => {
            const detailHref = returnTo
              ? withReturnTo(`/projects/${project.id}`, returnTo)
              : `/projects/${project.id}`;
            const isSubmitted = pipelineStatus(project.status) === "submitted";
            const skillsLabel = project.skills?.length ? project.skills.join(" • ") : "—";

            function handleRowActivate(event: React.MouseEvent | React.KeyboardEvent) {
              if (isBackgroundOpenModifier(event)) {
                event.preventDefault();
                openFreelancerFromClick(project, event);
                markProjectAsSeen(project, markProjectSeen, confirmProjectSeenOnServer, {
                  skipServer: true,
                });
                return;
              }
              if (returnTo) saveFindScrollRestore(returnTo);
              router.push(detailHref, { scroll: false });
              markProjectAsSeen(project, markProjectSeen, confirmProjectSeenOnServer, {
                skipServer: true,
              });
            }

            function prefetchDetail() {
              router.prefetch(detailHref);
            }

            return (
              <tr
                key={project.id}
                role="button"
                tabIndex={0}
                onMouseEnter={prefetchDetail}
                onFocus={prefetchDetail}
                onClick={(event) => handleRowActivate(event)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleRowActivate(event);
                  }
                }}
                className={`cursor-pointer border-b border-white/[0.06] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/40 ${rowHighlightClass(project.status)}`}
              >
                <td className="px-3 py-2">
                  <ProjectStatusBadge status={project.status} size="sm" />
                </td>
                <td className="max-w-[320px] px-3 py-2">
                  <div
                    className={`truncate font-medium ${
                      isSubmitted ? "text-emerald-100" : "text-zinc-200"
                    }`}
                    title={project.title}
                  >
                    {project.title}
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-zinc-400">
                  {project.budget_text || "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2 tabular-nums text-zinc-400">
                  {project.bid_count != null ? project.bid_count : "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2 tabular-nums text-zinc-300">
                  {isSubmitted ? formatSubmittedBid(project) : formatAvgBid(project)}
                </td>
                <td className="px-3 py-2">
                  <ClientCountryCell
                    country={project.client_country}
                    countryFlag={project.client_country_flag}
                    size="sm"
                  />
                </td>
                <td className="px-3 py-2">
                  <ClientRatingStars rating={project.client_rating} size="sm" />
                </td>
                <td className="px-3 py-2">
                  <ClientReviewCount count={project.client_review_count} size="sm" />
                </td>
                <td className="max-w-[200px] px-3 py-2">
                  <span className="block truncate text-xs text-indigo-300/90" title={skillsLabel}>
                    {skillsLabel}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2 tabular-nums text-zinc-400">
                  {project.risk_score != null ? `${project.risk_score}` : "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  <RelativeTime
                    value={projectPostedAt(project)}
                    titlePrefix="Posted"
                    className="text-xs text-zinc-500"
                  />
                </td>
                <td className="px-3 py-2" onClick={(event) => event.stopPropagation()}>
                  <div className="flex items-center gap-1.5">
                    <CopyProjectUrlButton project={project} />
                    <ToggleSubmittedButton project={project} onToggled={setProjectStatus} />
                    <DeleteProjectButton
                      projectId={project.id}
                      projectTitle={project.title}
                      onDeleted={removeProject}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
