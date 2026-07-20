"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ClientCountryCell,
  ClientRatingStars,
  ClientReviewCount,
} from "@/components/client-table-cells";
import { CopyProjectUrlButton } from "@/components/copy-project-url-button";
import { DeleteProjectButton } from "@/components/delete-project-button";
import { ToggleSubmittedButton } from "@/components/toggle-submitted-button";
import { GeneratingProjectBadge } from "@/components/proposal-generating-progress";
import { useDiscoverMonitor } from "@/components/discover-monitor";
import { ProjectStatusBadge } from "@/components/project-status-badge";
import { RelativeTime } from "@/components/relative-time";
import type { Project } from "@/lib/api";
import {
  activateFindProject,
  buildFindProjectDetailHref,
} from "@/lib/activate-find-project";
import { useProposalGeneration } from "@/hooks/use-proposal-generation";
import { formatProjectBudgetText } from "@/lib/project-budget";
import { pipelineStatus } from "@/lib/project-status";
import { projectPostedAt } from "@/lib/relative-time";

function formatAvgBid(project: Project): string {
  if (project.bid_avg == null) return "—";
  const sign = project.bid_currency_sign || "$";
  const amount = Math.round(Number(project.bid_avg));
  const suffix = project.budget_type === "hourly" ? "/hr" : "";
  return `${sign}${amount.toLocaleString()}${suffix}`;
}

function formatSubmittedBid(project: Project): string {
  if (project.submitted_bid_amount == null) return "—";
  const suffix = project.budget_type === "hourly" ? "/hr" : "";
  return `$${project.submitted_bid_amount.toLocaleString()}${suffix}`;
}

function rowHighlightClass(status: string, isGenerating: boolean): string {
  if (isGenerating) {
    return "border-l-2 border-l-violet-400/90 bg-violet-500/[0.08] hover:bg-violet-500/[0.12]";
  }
  const pipeline = pipelineStatus(status);
  if (pipeline === "new") {
    return "border-l-2 border-l-indigo-400/90 bg-indigo-500/[0.06] hover:bg-indigo-500/[0.1]";
  }
  if (pipeline === "submitted") {
    return "border-l-2 border-l-emerald-400/70 bg-emerald-500/[0.05] hover:bg-emerald-500/[0.09]";
  }
  return "hover:bg-white/[0.03]";
}

type ColumnKey =
  | "status"
  | "project"
  | "budget"
  | "bids"
  | "avgBid"
  | "country"
  | "rating"
  | "reviews"
  | "skills"
  | "risk"
  | "time"
  | "actions";

type CellContext = {
  isGenerating: boolean;
  isSubmitted: boolean;
  skillsLabel: string;
  setProjectStatus: (projectId: string, status: "submitted" | "viewed") => void;
  removeProject: (projectId: string) => void;
};

type ColumnDef = {
  key: ColumnKey;
  label: string;
  thClassName: string;
  tdClassName: string;
  stopPropagation?: boolean;
  render: (project: Project, ctx: CellContext) => React.ReactNode;
};

const COLUMNS: ColumnDef[] = [
  {
    key: "status",
    label: "Status",
    thClassName: "px-3 py-2.5 font-medium",
    tdClassName: "px-3 py-2",
    render: (project, ctx) => (
      <div className="flex flex-col gap-1">
        <ProjectStatusBadge status={project.status} size="sm" />
        {ctx.isGenerating ? <GeneratingProjectBadge compact /> : null}
      </div>
    ),
  },
  {
    key: "project",
    label: "Project",
    thClassName: "min-w-[220px] px-3 py-2.5 font-medium",
    tdClassName: "max-w-[320px] px-3 py-2",
    render: (project, ctx) => (
      <div
        className={`truncate font-medium ${
          ctx.isGenerating
            ? "text-violet-100"
            : ctx.isSubmitted
              ? "text-emerald-100"
              : "text-zinc-200"
        }`}
        title={project.title}
      >
        {project.title}
      </div>
    ),
  },
  {
    key: "budget",
    label: "Budget",
    thClassName: "px-3 py-2.5 font-medium",
    tdClassName: "whitespace-nowrap px-3 py-2 text-zinc-400",
    render: (project) => formatProjectBudgetText(project) || "—",
  },
  {
    key: "bids",
    label: "Bids",
    thClassName: "px-3 py-2.5 font-medium",
    tdClassName: "whitespace-nowrap px-3 py-2 tabular-nums text-zinc-400",
    render: (project) => (project.bid_count != null ? project.bid_count : "—"),
  },
  {
    key: "avgBid",
    label: "Avg bid",
    thClassName: "px-3 py-2.5 font-medium",
    tdClassName: "whitespace-nowrap px-3 py-2 tabular-nums text-zinc-300",
    render: (project, ctx) =>
      ctx.isSubmitted ? formatSubmittedBid(project) : formatAvgBid(project),
  },
  {
    key: "country",
    label: "Country",
    thClassName: "px-3 py-2.5 font-medium",
    tdClassName: "px-3 py-2",
    render: (project) => (
      <ClientCountryCell
        country={project.client_country}
        countryFlag={project.client_country_flag}
        size="sm"
      />
    ),
  },
  {
    key: "rating",
    label: "Rating",
    thClassName: "px-3 py-2.5 font-medium",
    tdClassName: "px-3 py-2",
    render: (project) => <ClientRatingStars rating={project.client_rating} size="sm" />,
  },
  {
    key: "reviews",
    label: "Reviews",
    thClassName: "px-3 py-2.5 font-medium",
    tdClassName: "px-3 py-2",
    render: (project) => <ClientReviewCount count={project.client_review_count} size="sm" />,
  },
  {
    key: "skills",
    label: "Skills",
    thClassName: "min-w-[160px] px-3 py-2.5 font-medium",
    tdClassName: "max-w-[200px] px-3 py-2",
    render: (project, ctx) => (
      <span className="block truncate text-xs text-indigo-300/90" title={ctx.skillsLabel}>
        {ctx.skillsLabel}
      </span>
    ),
  },
  {
    key: "risk",
    label: "Risk",
    thClassName: "px-3 py-2.5 font-medium",
    tdClassName: "whitespace-nowrap px-3 py-2 tabular-nums text-zinc-400",
    render: (project) => (project.risk_score != null ? `${project.risk_score}` : "—"),
  },
  {
    key: "time",
    label: "Time",
    thClassName: "px-3 py-2.5 font-medium",
    tdClassName: "whitespace-nowrap px-3 py-2",
    render: (project) => (
      <RelativeTime
        value={projectPostedAt(project)}
        titlePrefix="Posted"
        className="text-xs text-zinc-500"
      />
    ),
  },
  {
    key: "actions",
    label: "Actions",
    thClassName: "px-3 py-2.5 font-medium",
    tdClassName: "px-3 py-2",
    stopPropagation: true,
    render: (project, ctx) => (
      <div className="flex items-center gap-1.5">
        <CopyProjectUrlButton project={project} />
        <ToggleSubmittedButton project={project} onToggled={ctx.setProjectStatus} />
        <DeleteProjectButton
          projectId={project.id}
          projectTitle={project.title}
          onDeleted={ctx.removeProject}
        />
      </div>
    ),
  },
];

const COLUMN_MAP = COLUMNS.reduce<Record<ColumnKey, ColumnDef>>(
  (acc, column) => {
    acc[column.key] = column;
    return acc;
  },
  {} as Record<ColumnKey, ColumnDef>,
);

const DEFAULT_ORDER: ColumnKey[] = COLUMNS.map((column) => column.key);
const COLUMN_ORDER_KEY = "helm.find.table.column-order";

function reconcileOrder(stored: string[]): ColumnKey[] {
  const known = stored.filter((key): key is ColumnKey => key in COLUMN_MAP);
  const missing = DEFAULT_ORDER.filter((key) => !known.includes(key));
  return [...known, ...missing];
}

function readColumnOrder(): ColumnKey[] {
  if (typeof window === "undefined") return DEFAULT_ORDER;
  try {
    const raw = window.localStorage.getItem(COLUMN_ORDER_KEY);
    if (!raw) return DEFAULT_ORDER;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_ORDER;
    return reconcileOrder(parsed.map(String));
  } catch {
    return DEFAULT_ORDER;
  }
}

function writeColumnOrder(order: ColumnKey[]) {
  try {
    window.localStorage.setItem(COLUMN_ORDER_KEY, JSON.stringify(order));
  } catch {
    // Ignore persistence errors (e.g. storage disabled).
  }
}

export function ProjectFindTable({
  projects,
  returnTo,
}: {
  projects: Project[];
  returnTo?: string;
}) {
  const { markProjectSeen, confirmProjectSeenOnServer, removeProject, setProjectStatus } =
    useDiscoverMonitor();

  const [order, setOrder] = useState<ColumnKey[]>(DEFAULT_ORDER);
  const [dragKey, setDragKey] = useState<ColumnKey | null>(null);
  const [overKey, setOverKey] = useState<ColumnKey | null>(null);

  useEffect(() => {
    setOrder(readColumnOrder());
  }, []);

  function moveColumn(source: ColumnKey, target: ColumnKey) {
    if (source === target) return;
    setOrder((prev) => {
      const next = prev.filter((key) => key !== source);
      const targetIndex = next.indexOf(target);
      if (targetIndex === -1) return prev;
      next.splice(targetIndex, 0, source);
      writeColumnOrder(next);
      return next;
    });
  }

  function resetOrder() {
    setOrder(DEFAULT_ORDER);
    writeColumnOrder(DEFAULT_ORDER);
  }

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

  const orderedColumns = order.map((key) => COLUMN_MAP[key]);
  const isReordered = order.join("|") !== DEFAULT_ORDER.join("|");

  return (
    <div className="glass overflow-x-auto rounded-2xl">
      {isReordered ? (
        <div className="flex justify-end px-3 pt-2">
          <button
            type="button"
            onClick={resetOrder}
            className="text-[11px] uppercase tracking-wider text-zinc-500 transition hover:text-zinc-300"
          >
            Reset columns
          </button>
        </div>
      ) : null}
      <table className="w-full min-w-[1200px] text-left text-sm">
        <thead>
          <tr className="border-b border-white/[0.08] text-[11px] uppercase tracking-wider text-zinc-500">
            {orderedColumns.map((column) => (
              <th
                key={column.key}
                draggable
                onDragStart={() => setDragKey(column.key)}
                onDragEnter={() => setOverKey(column.key)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (dragKey) moveColumn(dragKey, column.key);
                  setDragKey(null);
                  setOverKey(null);
                }}
                onDragEnd={() => {
                  setDragKey(null);
                  setOverKey(null);
                }}
                className={`cursor-grab select-none transition active:cursor-grabbing ${column.thClassName} ${
                  dragKey === column.key ? "opacity-40" : ""
                } ${
                  overKey === column.key && dragKey && dragKey !== column.key
                    ? "bg-indigo-500/10 text-zinc-300"
                    : ""
                }`}
                title="Drag to reorder"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <FindProjectTableRow
              key={project.id}
              project={project}
              returnTo={returnTo}
              columns={orderedColumns}
              markProjectSeen={markProjectSeen}
              confirmProjectSeenOnServer={confirmProjectSeenOnServer}
              removeProject={removeProject}
              setProjectStatus={setProjectStatus}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FindProjectTableRow({
  project,
  returnTo,
  columns,
  markProjectSeen,
  confirmProjectSeenOnServer,
  removeProject,
  setProjectStatus,
}: {
  project: Project;
  returnTo?: string;
  columns: ColumnDef[];
  markProjectSeen: (projectId: string) => void;
  confirmProjectSeenOnServer: (projectId: string) => void;
  removeProject: (projectId: string) => void;
  setProjectStatus: (projectId: string, status: "submitted" | "viewed") => void;
}) {
  const router = useRouter();
  const { isGenerating } = useProposalGeneration(project.id);
  const detailHref = buildFindProjectDetailHref(project.id, returnTo);
  const isSubmitted = pipelineStatus(project.status) === "submitted";
  const skillsLabel = project.skills?.length ? project.skills.join(" • ") : "—";

  const cellContext: CellContext = {
    isGenerating,
    isSubmitted,
    skillsLabel,
    setProjectStatus,
    removeProject,
  };

  function handleRowActivate(event: React.MouseEvent | React.KeyboardEvent) {
    activateFindProject(event, project, detailHref, returnTo, router, {
      markProjectSeen,
      confirmProjectSeenOnServer,
    });
  }

  function prefetchDetail() {
    router.prefetch(detailHref);
  }

  return (
    <tr
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
      className={`cursor-pointer border-b border-white/[0.06] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/40 ${rowHighlightClass(project.status, isGenerating)}`}
    >
      {columns.map((column) => (
        <td
          key={column.key}
          className={column.tdClassName}
          onClick={column.stopPropagation ? (event) => event.stopPropagation() : undefined}
        >
          {column.render(project, cellContext)}
        </td>
      ))}
    </tr>
  );
}

