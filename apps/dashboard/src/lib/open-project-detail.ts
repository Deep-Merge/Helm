export type OpenProjectDetailOptions = {
  /** Keep focus on the current dashboard tab. */
  background?: boolean;
};

function toAbsoluteUrl(href: string): string {
  return new URL(href, window.location.href).href;
}

function withStayOnList(href: string): string {
  const url = new URL(href, window.location.href);
  url.searchParams.set("stay", "1");
  return url.href;
}

function returnFocusToList() {
  window.focus();
  requestAnimationFrame(() => window.focus());
  window.setTimeout(() => window.focus(), 0);
  window.setTimeout(() => window.focus(), 40);
}

/**
 * Open project detail in a new tab immediately.
 * Background keeps opener so the new page can return focus to the list.
 */
export function openProjectDetailInNewTab(
  href: string,
  options: OpenProjectDetailOptions = { background: true },
): boolean {
  if (!options.background) {
    const opened = window.open(toAbsoluteUrl(href), "_blank", "noopener,noreferrer");
    return opened !== null;
  }

  const opened = window.open(withStayOnList(href), "_blank");
  try {
    opened?.blur();
  } catch {
    /* ignore */
  }
  returnFocusToList();
  return opened !== null;
}
