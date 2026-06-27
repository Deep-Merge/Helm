import {
  pipelineLabel,
  pipelineStatus,
  pipelineStyles,
  type ProjectPipelineStatus,
} from "@/lib/project-status";

export function ProjectStatusBadge({
  status,
  size = "sm",
}: {
  status: string;
  size?: "sm" | "md";
}) {
  const pipe: ProjectPipelineStatus = pipelineStatus(status);
  const textSize = size === "md" ? "text-sm px-3 py-1" : "text-xs px-2.5 py-0.5";

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full font-medium ring-1 ring-inset ${textSize} ${pipelineStyles[pipe]}`}
    >
      {pipelineLabel(status)}
    </span>
  );
}
