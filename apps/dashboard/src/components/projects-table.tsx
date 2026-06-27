"use client";

import { useRouter } from "next/navigation";
import {
  ClientCountryCell,
  ClientRatingStars,
  ClientReviewCount,
} from "@/components/client-table-cells";
import { CopyProjectUrlButton } from "@/components/copy-project-url-button";
import { DeleteProjectButton } from "@/components/delete-project-button";
import { OpenProjectButton } from "@/components/open-project-button";
import { useDiscoverMonitor } from "@/components/discover-monitor";
import { formatBudgetTypeLabel } from "@/components/filter-field";
import { ProjectStatusBadge } from "@/components/project-status-badge";
import type { Project } from "@/lib/api";
import { markProjectAsSeen } from "@/lib/mark-project-seen";
import { openFreelancerFromClick, openFreelancerInNewTab, isBackgroundOpenModifier } from "@/lib/open-freelancer";
import { projectPostedAt } from "@/lib/relative-time";
import { withReturnTo } from "@/lib/return-to";

function formatBid(amount: number | null | undefined, budgetType?: string) {
  if (amount == null) return "—";
  const suffix = budgetType === "hourly" ? " / hr" : "";
  return `$${amount.toLocaleString()}${suffix}`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function StatusBadge({ status }: { status: string }) {
  return <ProjectStatusBadge status={status} />;
}

export function ProjectsTable({
  projects,
  showCountry = false,
  variant = "default",
  returnTo,
}: {
  projects: Project[];
  showCountry?: boolean;
  variant?: "default" | "submitted";
  /** Full path + query to restore when opening a project from a filtered list. */
  returnTo?: string;
}) {
  const router = useRouter();
  const { markProjectSeen, confirmProjectSeenOnServer } = useDiscoverMonitor();
  const isSubmitted = variant === "submitted";

  if (projects.length === 0) {
    return (
      <div className="glass flex flex-col items-center justify-center rounded-2xl py-16 text-center">
        <p className="text-lg font-medium text-zinc-300">No projects yet</p>
        <p className="mt-2 max-w-sm text-sm text-zinc-500">
          {isSubmitted
            ? "Place bids on Freelancer with the extension to see them here."
            : "Try different filters or search Freelancer for more projects."}
        </p>
      </div>
    );
  }

  return (
    <div className="glass overflow-x-auto rounded-2xl">
      <table className="w-full min-w-[1020px] text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-xs uppercase tracking-wider text-zinc-500">
            <th className="px-5 py-4 font-medium">Project</th>
            <th className="px-5 py-4 font-medium">Budget</th>
            {isSubmitted && (
              <>
                <th className="px-5 py-4 font-medium">My bid</th>
                <th className="px-5 py-4 font-medium">Type</th>
                <th className="px-5 py-4 font-medium">Days</th>
                <th className="px-5 py-4 font-medium">Country</th>
                <th className="px-5 py-4 font-medium">Rating</th>
                <th className="px-5 py-4 font-medium">Reviews</th>
              </>
            )}
            {showCountry && !isSubmitted && <th className="px-5 py-4 font-medium">Country</th>}
            {!isSubmitted && <th className="px-5 py-4 font-medium">Status</th>}
            {!isSubmitted && <th className="px-5 py-4 font-medium">Risk</th>}
            <th className="px-5 py-4 font-medium">Actions</th>
            <th className="px-5 py-4 font-medium">Time</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => {
            const detailHref = returnTo
              ? withReturnTo(`/projects/${p.id}`, returnTo)
              : `/projects/${p.id}`;

            const openProjectDetails = () => {
              markProjectAsSeen(p, markProjectSeen, confirmProjectSeenOnServer, { skipServer: true });
              router.push(detailHref);
            };

            const openFreelancerProject = (event?: React.MouseEvent) => {
              markProjectAsSeen(p, markProjectSeen, confirmProjectSeenOnServer);
              if (event && openFreelancerFromClick(p, event)) {
                return;
              }
              openFreelancerInNewTab(p);
            };

            const openDefaultRowTarget = (event: React.MouseEvent) => {
              if (isBackgroundOpenModifier(event)) {
                event.preventDefault();
                openFreelancerFromClick(p, event);
                markProjectAsSeen(p, markProjectSeen, confirmProjectSeenOnServer, {
                  skipServer: true,
                });
                return;
              }
              markProjectAsSeen(p, markProjectSeen, confirmProjectSeenOnServer);
              router.push(detailHref);
            };

            return (
              <tr
                key={p.id}
                role={isSubmitted ? "button" : undefined}
                tabIndex={isSubmitted ? 0 : undefined}
                onClick={isSubmitted ? openProjectDetails : undefined}
                onKeyDown={
                  isSubmitted
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openProjectDetails();
                        }
                      }
                    : undefined
                }
                className={`border-b border-[var(--border)] transition ${
                  isSubmitted
                    ? "cursor-pointer hover:bg-white/[0.04] focus-visible:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/40"
                    : "hover:bg-white/[0.02]"
                }`}
              >
                <td className="px-5 py-4">
                  {isSubmitted ? (
                    <div className="block w-full text-left">
                      <div className="font-medium text-zinc-200">{p.title}</div>
                      {p.url && (
                        <div className="mt-0.5 truncate text-xs text-zinc-500">{p.url}</div>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={openDefaultRowTarget}
                      className="group block w-full text-left"
                    >
                      <div className="font-medium text-zinc-200 group-hover:text-indigo-300">
                        {p.title}
                      </div>
                      {p.url && (
                        <div className="mt-0.5 truncate text-xs text-zinc-500">{p.url}</div>
                      )}
                    </button>
                  )}
                </td>
                <td className="px-5 py-4 text-zinc-400">{p.budget_text || "—"}</td>
                {isSubmitted && (
                  <>
                    <td className="px-5 py-4 text-zinc-300">
                      {formatBid(p.submitted_bid_amount, p.budget_type)}
                    </td>
                    <td className="px-5 py-4">
                      {formatBudgetTypeLabel(p.budget_type) ? (
                        <span
                          className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                            p.budget_type === "hourly"
                              ? "bg-violet-500/10 text-violet-300 ring-violet-500/25"
                              : "bg-sky-500/10 text-sky-300 ring-sky-500/25"
                          }`}
                        >
                          {formatBudgetTypeLabel(p.budget_type)}
                        </span>
                      ) : (
                        <span className="text-zinc-500">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-zinc-400">
                      {p.submitted_delivery_days != null ? `${p.submitted_delivery_days}d` : "—"}
                    </td>
                    <td className="px-5 py-4">
                      <ClientCountryCell
                        country={p.client_country}
                        countryFlag={p.client_country_flag}
                      />
                    </td>
                    <td className="px-5 py-4">
                      <ClientRatingStars rating={p.client_rating} />
                    </td>
                    <td className="px-5 py-4">
                      <ClientReviewCount count={p.client_review_count} />
                    </td>
                  </>
                )}
                {showCountry && !isSubmitted && (
                  <td className="px-5 py-4">
                    <ClientCountryCell
                      country={p.client_country}
                      countryFlag={p.client_country_flag}
                    />
                  </td>
                )}
                {!isSubmitted && (
                  <td className="px-5 py-4">
                    <StatusBadge status={p.status} />
                  </td>
                )}
                {!isSubmitted && (
                  <td className="px-5 py-4 text-zinc-400">
                    {p.risk_score != null ? `${p.risk_score}/100` : "—"}
                  </td>
                )}
                <td className="px-5 py-4">
                  <div className="flex items-center gap-1.5">
                    <OpenProjectButton
                      size="sm"
                      onClick={(event) => {
                        if (isSubmitted) {
                          openFreelancerProject(event);
                          return;
                        }
                        openProjectDetails();
                      }}
                    />
                    <CopyProjectUrlButton project={p} />
                    <DeleteProjectButton
                      projectId={p.id}
                      projectTitle={p.title}
                      onDeleted={() => router.refresh()}
                    />
                  </div>
                </td>
                <td className="px-5 py-4 whitespace-nowrap text-zinc-500">
                  {formatDateTime(
                    isSubmitted ? p.submitted_at : projectPostedAt(p),
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
