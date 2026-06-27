/** User-facing pipeline: new → seen → submitted */

export type ProjectPipelineStatus = "new" | "seen" | "submitted";

const STATUS_RANK: Record<string, number> = {
  new: 0,
  viewed: 1,
  drafted: 1,
  submitted: 2,
  ignored: 3,
  won: 4,
  lost: 5,
};

export function pipelineStatus(status: string): ProjectPipelineStatus {
  if (status === "submitted" || status === "won" || status === "lost") return "submitted";
  if (status === "new") return "new";
  return "seen";
}

export function pipelineLabel(status: string): string {
  const pipe = pipelineStatus(status);
  if (pipe === "new") return "New";
  if (pipe === "submitted") return "Submitted";
  return "Seen";
}

export function pipelineSortRank(status: string): number {
  return STATUS_RANK[status] ?? 9;
}

export const pipelineStyles: Record<ProjectPipelineStatus, string> = {
  new: "bg-indigo-500/30 text-indigo-100 ring-2 ring-indigo-400/60",
  seen: "bg-zinc-500/15 text-zinc-300 ring-zinc-500/30",
  submitted: "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-400/45",
};
