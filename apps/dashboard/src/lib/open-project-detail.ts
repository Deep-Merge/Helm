export type OpenProjectDetailOptions = {
  /** Keep focus on the current dashboard tab (Ctrl/Cmd+click). */
  background?: boolean;
};

/**
 * Open a project detail in a real background tab without stealing focus.
 * A synthetic Ctrl/Cmd-click on an anchor lets the browser open the tab in the
 * background natively — unlike `window.open`, which foregrounds the new tab.
 */
function openInBackgroundTab(href: string): boolean {
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.style.display = "none";
  document.body.appendChild(anchor);

  const isMac =
    typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
  const event = new MouseEvent("click", {
    bubbles: true,
    cancelable: true,
    view: window,
    button: 0,
    // Ctrl (or Cmd on macOS) tells the browser to open in a background tab
    // without shifting focus away from the current tab.
    ctrlKey: !isMac,
    metaKey: isMac,
  });
  anchor.dispatchEvent(event);
  anchor.remove();
  return true;
}

/** Open Helm project detail in a new tab (must run inside the click handler). */
export function openProjectDetailInNewTab(
  href: string,
  options: OpenProjectDetailOptions = { background: true },
): boolean {
  if (options.background) {
    return openInBackgroundTab(href);
  }

  const opened = window.open(href, "_blank", "noopener,noreferrer");
  return opened !== null;
}
