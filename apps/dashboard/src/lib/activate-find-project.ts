"use client";

import type { Project } from "@/lib/api";
import { saveFindScrollRestore } from "@/lib/find-scroll-restore";
import { markProjectAsSeen } from "@/lib/mark-project-seen";
import { openProjectDetailInNewTab } from "@/lib/open-project-detail";
import { isBackgroundOpenModifier } from "@/lib/open-freelancer";
import { shouldAutoGenerateProject } from "@/lib/proposal-generation-store";
import { cacheProject } from "@/lib/project-cache";
import { withReturnTo } from "@/lib/return-to";
import { copyProjectUrlToClipboard } from "@/lib/copy-project-url";

type MarkSeenFns = {
  markProjectSeen: (id: string) => void;
  confirmProjectSeenOnServer: (id: string) => void;
};

// Ctrl+Alt (or Cmd+Alt) opens the project in a background tab and generates its
// proposal there, without switching away from the list. A plain click or a
// Ctrl/Cmd click never triggers generation.
function isGenerateProposalModifier(
  event: React.MouseEvent | React.KeyboardEvent,
): boolean {
  return (event.ctrlKey || event.metaKey) && event.altKey;
}

function withGenerateFlag(href: string): string {
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}generate=1`;
}

export function activateFindProject(
  event: React.MouseEvent | React.KeyboardEvent,
  project: Project,
  detailHref: string,
  returnTo: string | undefined,
  router: { push: (href: string, options?: { scroll?: boolean }) => void },
  markSeen: MarkSeenFns,
) {
  cacheProject(project);

  // Ctrl+Alt: open a background tab that generates the proposal; stay on list.
  if (isGenerateProposalModifier(event)) {
    event.preventDefault();
    const href = shouldAutoGenerateProject(project)
      ? withGenerateFlag(detailHref)
      : detailHref;
    openProjectDetailInNewTab(href, { background: true });
    markProjectAsSeen(project, markSeen.markProjectSeen, markSeen.confirmProjectSeenOnServer, {
      skipServer: true,
    });
    return;
  }

  if (isBackgroundOpenModifier(event)) {
    event.preventDefault();
    openProjectDetailInNewTab(detailHref, { background: true });
    markProjectAsSeen(project, markSeen.markProjectSeen, markSeen.confirmProjectSeenOnServer, {
      skipServer: true,
    });
    return;
  }

  void copyProjectUrlToClipboard(project);
  if (returnTo) saveFindScrollRestore(returnTo);
  router.push(detailHref, { scroll: false });
  markProjectAsSeen(project, markSeen.markProjectSeen, markSeen.confirmProjectSeenOnServer, {
    skipServer: true,
  });
}

export function buildFindProjectDetailHref(projectId: string, returnTo?: string): string {
  const href = `/projects/${projectId}`;
  return returnTo ? withReturnTo(href, returnTo) : href;
}
