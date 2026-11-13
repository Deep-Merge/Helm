"use client";

import type { Project } from "@/lib/api";
import { saveFindScrollRestore } from "@/lib/find-scroll-restore";
import { markProjectAsSeen } from "@/lib/mark-project-seen";
import { isBackgroundOpenModifier } from "@/lib/open-freelancer";
import {
  ensureProposalGeneration,
  markBackgroundGenerateOpen,
  shouldAutoGenerateProject,
} from "@/lib/proposal-generation-store";
import { cacheProject } from "@/lib/project-cache";
import { withReturnTo } from "@/lib/return-to";
import { copyProjectUrlToClipboard } from "@/lib/copy-project-url";

type MarkSeenFns = {
  markProjectSeen: (id: string) => void;
  confirmProjectSeenOnServer: (id: string) => void;
};

function isGenerateProposalModifier(
  event: React.MouseEvent | React.KeyboardEvent | Pick<MouseEvent, "altKey">,
): boolean {
  return Boolean(event.altKey);
}

function withGenerateFlag(href: string): string {
  const url = new URL(href, typeof window !== "undefined" ? window.location.href : "http://localhost");
  url.searchParams.set("generate", "1");
  return `${url.pathname}${url.search}${url.hash}`;
}

function isAnchorMouseClick(
  event: React.MouseEvent | React.KeyboardEvent,
): event is React.MouseEvent<HTMLAnchorElement> {
  return "button" in event && event.currentTarget instanceof HTMLAnchorElement;
}

/**
 * Before Alt+click, put generate=1 on the real <a> so the Helm content script
 * can open that URL in a background tab (chrome.tabs.create({ active: false })).
 */
export function applyFindProjectOpenHref(
  anchor: HTMLAnchorElement,
  event: Pick<MouseEvent, "altKey" | "ctrlKey" | "metaKey"> & { preventDefault?: () => void },
  project: Project,
  detailHref: string,
) {
  if (event.altKey) {
    event.preventDefault?.();
    const href = shouldAutoGenerateProject(project) ? withGenerateFlag(detailHref) : detailHref;
    anchor.setAttribute("href", href);
    return;
  }
  anchor.setAttribute("href", detailHref);
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

  if (isGenerateProposalModifier(event)) {
    // If the Helm extension handled this click, React never gets here.
    // Fallback (no extension): stay on the list and generate here.
    event.preventDefault();
    if ("stopPropagation" in event) event.stopPropagation();
    if (shouldAutoGenerateProject(project)) {
      void ensureProposalGeneration(project).catch(() => {
        /* status is stored on the job */
      });
    }
    markProjectAsSeen(project, markSeen.markProjectSeen, markSeen.confirmProjectSeenOnServer, {
      skipServer: true,
    });
    return;
  }

  if (isBackgroundOpenModifier(event)) {
    if (!isAnchorMouseClick(event)) {
      event.preventDefault();
    }
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

export function listenForBackgroundProjectOpen() {
  if (typeof window === "undefined") return () => {};

  const onMessage = (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;
    const data = event.data as { source?: string; type?: string; projectId?: string } | null;
    if (data?.source !== "helm-extension" || data.type !== "BACKGROUND_PROJECT_OPENED") return;
    if (data.projectId) markBackgroundGenerateOpen(data.projectId);
  };

  window.addEventListener("message", onMessage);
  return () => window.removeEventListener("message", onMessage);
}
