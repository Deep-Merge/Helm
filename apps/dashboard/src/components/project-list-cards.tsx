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
import { markProjectAsSeen } from "@/lib/mark-project-seen";
import { saveFindScrollRestore } from "@/lib/find-scroll-restore";
import { openFreelancerFromClick, isBackgroundOpenModifier } from "@/lib/open-freelancer";
import { pipelineStatus } from "@/lib/project-status";
import { projectPostedAt } from "@/lib/relative-time";
import { withReturnTo } from "@/lib/return-to";

const VISIBLE_SKILLS = 5;
const DESCRIPTION_LIMIT = 280;

function truncateDescription(text: string, compact: boolean): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (compact) return clean;
  if (clean.length <= DESCRIPTION_LIMIT) return clean;
  return `${clean.slice(0, DESCRIPTION_LIMIT).trim()}…`;
}

function formatAvgBid(project: Project, compact: boolean): string | null {
  if (project.bid_avg == null) return null;
  const sign = project.bid_currency_sign || "$";
  const code = project.bid_currency_code || "USD";
  const amount = Number(project.bid_avg);
  const formatted = Number.isInteger(amount) ? amount.toLocaleString() : amount.toFixed(0);
  const suffix = project.budget_type === "hourly" ? (compact ? "/hr" : " per hour") : "";
  return compact
    ? `${sign}${formatted}${suffix}`
    : `${sign}${formatted} ${code}${suffix}`;
}

function SkillsRow({ skills, compact }: { skills: string[]; compact: boolean }) {
  if (!skills.length) return null;

  if (compact) {
    return (
      <p className="mt-1 truncate text-sm text-indigo-300/90" title={skills.join(" • ")}>
        {skills.join(" • ")}
      </p>
    );
  }

  const visible = skills.slice(0, VISIBLE_SKILLS);
  const remaining = skills.length - visible.length;

  return (
    <div className="mt-3 text-[17px] leading-relaxed text-indigo-300/90">
      {visible.map((skill, index) => (
        <span key={skill}>
          {index > 0 && <span className="text-zinc-600"> • </span>}
          <span>{skill}</span>
        </span>
      ))}
      {remaining > 0 && (
        <>
          <span className="text-zinc-600"> • </span>
          <span>{remaining} more</span>
        </>
      )}
    </div>
  );
}

export function ProjectListCards({
  projects,
  returnTo,
  compact = false,
}: {
  projects: Project[];
  returnTo?: string;
  compact?: boolean;
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
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {projects.map((project) => {
        const detailHref = returnTo
          ? withReturnTo(`/projects/${project.id}`, returnTo)
          : `/projects/${project.id}`;
        const avgBid = formatAvgBid(project, compact);
        const description = truncateDescription(project.description || "", compact);
        const isNew = pipelineStatus(project.status) === "new";
        const isSubmitted = pipelineStatus(project.status) === "submitted";
        const hasMore =
          !compact &&
          project.description &&
          project.description.replace(/\s+/g, " ").trim().length > DESCRIPTION_LIMIT;

        function handleCardActivate(event: React.MouseEvent | React.KeyboardEvent) {
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
          <div
            key={project.id}
            role="button"
            tabIndex={0}
            onMouseEnter={prefetchDetail}
            onFocus={prefetchDetail}
            onClick={(event) => handleCardActivate(event)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleCardActivate(event);
              }
            }}
            className={`group block cursor-pointer rounded-2xl outline-none transition-shadow duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090b] ${
              isNew
                ? "ring-2 ring-indigo-400/90 ring-offset-2 ring-offset-[#09090b] hover:ring-indigo-400/70 focus-visible:ring-indigo-500/50"
                : isSubmitted
                  ? "ring-2 ring-emerald-400/50 ring-offset-2 ring-offset-[#09090b] hover:ring-emerald-300/65 focus-visible:ring-emerald-300/70"
                  : "hover:ring-2 hover:ring-indigo-400/70 hover:ring-offset-2 hover:ring-offset-[#09090b] focus-visible:ring-indigo-500/50"
            }`}
          >
            <article
              className={`relative overflow-hidden rounded-2xl transition-[border-color,box-shadow,background-color] duration-200 ${
                compact ? "px-4 py-3" : "px-6 py-5"
              } ${
                isNew
                  ? "border-2 border-indigo-400/80 bg-indigo-500/[0.12] shadow-[0_0_0_1px_rgba(129,140,248,0.5),0_0_32px_-6px_rgba(99,102,241,0.75)] group-hover:border-indigo-300 group-hover:shadow-[0_0_0_1px_rgba(165,180,252,0.7),0_0_48px_-4px_rgba(99,102,241,0.9)]"
                  : isSubmitted
                    ? "border-2 border-emerald-400/55 bg-gradient-to-br from-emerald-500/[0.12] via-[#0c1210] to-teal-500/[0.06] shadow-[0_0_0_1px_rgba(52,211,153,0.45),0_8px_32px_-12px_rgba(16,185,129,0.3)] group-hover:border-emerald-300/70 group-hover:shadow-[0_0_0_1px_rgba(110,231,183,0.55),0_12px_40px_-10px_rgba(16,185,129,0.38)]"
                    : "glass border border-white/[0.06] group-hover:border-indigo-300/80 group-hover:shadow-[0_0_0_1px_rgba(129,140,248,0.45),0_0_40px_-4px_rgba(99,102,241,0.65)]"
              }`}
            >
              {isNew && (
                <div
                  className={`absolute inset-y-0 left-0 bg-gradient-to-b from-indigo-300 via-indigo-400 to-indigo-500 ${
                    compact ? "w-1" : "w-1.5"
                  }`}
                  aria-hidden
                />
              )}
              {isSubmitted && !isNew && (
                <div
                  className={`absolute inset-y-0 left-0 bg-gradient-to-b from-emerald-300 via-emerald-400 to-teal-500 ${
                    compact ? "w-1" : "w-1.5"
                  }`}
                  aria-hidden
                />
              )}
              <div className={`flex items-start justify-between ${compact ? "gap-3" : "gap-6"}`}>
                <div className="min-w-0 flex-1">
                  <div className={`flex flex-wrap items-center gap-2 ${compact ? "mb-1" : "mb-2"}`}>
                    <ProjectStatusBadge status={project.status} size={compact ? "sm" : "md"} />
                    {compact && project.budget_text && (
                      <span className="truncate text-xs text-zinc-500">{project.budget_text}</span>
                    )}
                  </div>
                  <h3
                    className={`font-semibold ${
                      isSubmitted
                        ? "text-emerald-50 group-hover:text-white"
                        : "text-indigo-300"
                    } ${
                      compact
                        ? "truncate text-base leading-snug"
                        : "text-[20px] leading-snug"
                    }`}
                  >
                    {project.title}
                  </h3>
                  {!compact && project.budget_text && (
                    <p className="mt-1.5 text-[17px] text-zinc-400">
                      Budget {project.budget_text}
                    </p>
                  )}
                </div>

                <div className={`shrink-0 text-right ${compact ? "min-w-[4.5rem]" : "w-[148px]"}`}>
                  {isSubmitted && project.submitted_bid_amount != null ? (
                    <>
                      <p className={compact ? "text-[10px] text-emerald-300/70" : "text-[11px] font-semibold uppercase tracking-wider text-emerald-300/80"}>
                        Your bid
                      </p>
                      <p
                        className={
                          compact
                            ? "text-sm font-bold tabular-nums text-emerald-50"
                            : "mt-0.5 text-[23px] font-bold leading-tight tabular-nums text-emerald-50"
                        }
                      >
                        ${project.submitted_bid_amount.toLocaleString()}
                        {project.budget_type === "hourly" ? "/hr" : ""}
                      </p>
                    </>
                  ) : (
                    <>
                      {project.bid_count != null && (
                        <p className={compact ? "text-xs text-zinc-500" : "text-[15px] text-zinc-500"}>
                          {project.bid_count} bid{project.bid_count === 1 ? "" : "s"}
                        </p>
                      )}
                      {avgBid && (
                        <>
                          <p
                            className={
                              compact
                                ? "text-sm font-semibold tabular-nums text-zinc-100"
                                : "mt-0.5 text-[23px] font-semibold leading-tight tabular-nums text-zinc-100"
                            }
                          >
                            {avgBid}
                          </p>
                          {!compact && (
                            <p className="text-[14px] text-zinc-500">average bid</p>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>

              {description && (
                <p
                  className={
                    compact
                      ? "mt-1.5 truncate text-sm text-zinc-400"
                      : "mt-3 text-[17px] leading-relaxed text-zinc-400"
                  }
                >
                  {description}
                  {hasMore && (
                    <span className="ml-1 text-[17px] text-indigo-400">more</span>
                  )}
                </p>
              )}

              <SkillsRow skills={project.skills} compact={compact} />

              <div
                className={`flex flex-wrap items-center justify-between gap-2 border-t ${
                  isSubmitted ? "border-t-2 border-emerald-400/35" : "border-white/[0.06]"
                } ${compact ? "mt-2 pt-2 text-sm" : "mt-4 gap-3 pt-3.5 text-[17px]"}`}
              >
                <div className={`flex flex-wrap items-center ${compact ? "gap-2" : "gap-3.5"}`}>
                  <ClientCountryCell
                    country={project.client_country}
                    countryFlag={project.client_country_flag}
                    size={compact ? "sm" : "md"}
                  />
                  <ClientRatingStars rating={project.client_rating} size={compact ? "sm" : "md"} />
                  <ClientReviewCount
                    count={project.client_review_count}
                    size={compact ? "sm" : "md"}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <CopyProjectUrlButton project={project} />
                  <ToggleSubmittedButton project={project} onToggled={setProjectStatus} />
                  <DeleteProjectButton
                    projectId={project.id}
                    projectTitle={project.title}
                    onDeleted={removeProject}
                  />
                  <RelativeTime
                    value={projectPostedAt(project)}
                    titlePrefix="Posted"
                    className={compact ? "text-xs text-zinc-500" : "text-[15px] text-zinc-500"}
                  />
                </div>
              </div>
            </article>
          </div>
        );
      })}
    </div>
  );
}
