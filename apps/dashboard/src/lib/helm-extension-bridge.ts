const STORAGE_KEY = "helm-extension-id";

function envExtensionId(): string | null {
  const id = process.env.NEXT_PUBLIC_EXTENSION_ID;
  return id && id.trim() ? id.trim() : null;
}

function readStoredId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

let extensionId: string | null = envExtensionId() || readStoredId();

function setExtensionId(id: string) {
  extensionId = id;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) return;
    const data = event.data as { source?: string; type?: string; extensionId?: string } | null;
    if (data?.source !== "helm-extension") return;
    if (data.type === "HELM_EXTENSION_READY" && typeof data.extensionId === "string") {
      setExtensionId(data.extensionId);
    }
  });
  window.postMessage({ source: "helm-dashboard", type: "HELM_EXTENSION_PING" }, window.location.origin);
}

/** Open a tab without focusing it. Requires the Helm extension on this page. */
export function openHelmBackgroundTab(url: string): boolean {
  if (typeof window === "undefined") return false;

  if (extensionId && typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
    try {
      chrome.runtime.sendMessage(extensionId, { type: "OPEN_BACKGROUND_TAB", url }, () => {
        void chrome.runtime?.lastError;
      });
      return true;
    } catch {
      /* fall through */
    }
  }

  if (!extensionId) {
    window.postMessage(
      { source: "helm-dashboard", type: "OPEN_BACKGROUND_TAB", url },
      window.location.origin,
    );
  }

  return Boolean(extensionId);
}
