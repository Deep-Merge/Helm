"use client";

import type { Project } from "@/lib/api";
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
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={(event) => {
        event.preventDefault();
        openFreelancerInNewTab(project, { background: isBackgroundOpenModifier(event) });
      }}
    >
      {project.title}
    </a>
  );
}
