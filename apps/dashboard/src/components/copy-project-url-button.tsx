"use client";

import { CopyButton } from "@/components/copy-button";
import type { Project } from "@/lib/api";
import { freelancerProjectUrl } from "@/lib/freelancer-url";

export function CopyProjectUrlButton({
  project,
  className = "",
}: {
  project: Pick<Project, "url" | "freelancer_project_id">;
  className?: string;
}) {
  const url = freelancerProjectUrl(project) ?? "";

  return (
    <span
      className={className}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <CopyButton text={url} label="Copy project URL" />
    </span>
  );
}
