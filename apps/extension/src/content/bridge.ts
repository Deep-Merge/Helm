// Bridges the Helm dashboard page and the extension background worker.
//
// Alt+click on a project link is captured here (trusted extension code) and
// opened with chrome.tabs.create({ active: false }) so Chrome does not switch
// to the new tab. window.open from the page cannot do that.

type BridgeMessage = {
  type?: string;
  count?: number;
  url?: string;
};

function projectIdFromHref(href: string): string | null {
  try {
    const match = new URL(href, window.location.href).pathname.match(/\/projects\/([^/]+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function announceReady() {
  window.postMessage(
    {
      source: "helm-extension",
      type: "HELM_EXTENSION_READY",
      extensionId: chrome.runtime.id,
    },
    window.location.origin,
  );
}

announceReady();

chrome.runtime.onMessage.addListener((message: BridgeMessage) => {
  if (message?.type === "NEW_PROJECTS") {
    window.postMessage(
      {
        source: "helm-extension",
        type: "NEW_PROJECTS",
        count: typeof message.count === "number" ? message.count : 0,
      },
      window.location.origin,
    );
  }
});

document.addEventListener(
  "click",
  (event) => {
    if (!event.altKey || event.button !== 0) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const link = target.closest("a[data-helm-background='generate']");
    if (!(link instanceof HTMLAnchorElement) || !link.href) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const url = link.href;
    void chrome.runtime.sendMessage({ type: "OPEN_BACKGROUND_TAB", url }, () => {
      void chrome.runtime.lastError;
    });

    window.postMessage(
      {
        source: "helm-extension",
        type: "BACKGROUND_PROJECT_OPENED",
        projectId: projectIdFromHref(url),
        url,
      },
      window.location.origin,
    );
  },
  true,
);

window.addEventListener("message", (event) => {
  if (event.source !== window || event.origin !== window.location.origin) return;
  const data = event.data as { source?: string; type?: string } | null;
  if (data?.source !== "helm-dashboard") return;
  if (data.type === "HELM_EXTENSION_PING") announceReady();
});
