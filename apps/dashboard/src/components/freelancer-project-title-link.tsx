"use client";

import type { Project } from "@/lib/api";
import { copyProjectUrlToClipboard } from "@/lib/copy-project-url";
import { openFreelancerInNewTab, isBackgroundOpenModifier } from "@/lib/open-freelancer";
import { freelancerProjectUrl } from "@/lib/freelancer-url";

export function FreelancerProjectTitleLink({
  project,
  className = "",
}: {
  project: Project;
  className?: string;
}) {
  const url = freelancerProjectUrl(project);

  if (!url) {
    return <span className={className}>{project.title}</span>;
  }

  return (
    <button
      type="button"
      className={`cursor-pointer text-left transition hover:text-indigo-300 ${className}`}
      onClick={(event) => {
        if (isBackgroundOpenModifier(event)) {
          openFreelancerInNewTab(project, { background: true });
          return;
        }
        void copyProjectUrlToClipboard(project);
      }}
    >
      {project.title}
    </button>
  );
}
