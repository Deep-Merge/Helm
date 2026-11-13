chrome.alarms.create("ba-watcher", { periodInMinutes: 1 });

const HANDOFF_STORAGE_KEY = "ba-dashboard-handoff";

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get([
    "apiUrl",
    "authToken",
    "watcherEnabled",
    "modelTier",
    "defaultDirection",
  ]);
  const patch: Record<string, unknown> = {};
  if (!current.apiUrl) patch.apiUrl = "http://127.0.0.1:8000";
  if (!current.authToken) patch.authToken = "dev-token";
  if (current.watcherEnabled === undefined) patch.watcherEnabled = true;
  if (!current.modelTier) patch.modelTier = "auto";
  if (!current.defaultDirection) {
    patch.defaultDirection = "Make it confident and human. Ask to discuss in Freelancer chat.";
  }
  if (Object.keys(patch).length) {
    await chrome.storage.local.set(patch);
  }
});

function saveAuthToken(message: { token?: string; apiUrl?: string }) {
  if (message.token) {
    chrome.storage.local.set({
      authToken: message.token,
      apiUrl: message.apiUrl || "http://localhost:8000",
    });
  }
}

async function saveDashboardHandoff(message: {
  autoGenerate?: boolean;
  fillSubmitted?: boolean;
  project?: unknown;
  bid?: unknown;
}): Promise<boolean> {
  if (!message?.project || typeof message.project !== "object") return false;
  const handoff = {
    createdAt: Date.now(),
    autoGenerate: message.autoGenerate === true,
    fillSubmitted: message.fillSubmitted === true,
    project: message.project,
    bid: message.bid,
  };
  await chrome.storage.local.set({ [HANDOFF_STORAGE_KEY]: handoff });
  return true;
}

function normalizeProjectPath(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname.replace(/\/details\/?$/i, "").replace(/\/+$/, "").toLowerCase();
  } catch {
    return url.replace(/\/details\/?$/i, "").replace(/\/+$/, "").toLowerCase();
  }
}

function waitForTabComplete(tabId: number, timeoutMs = 25000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      reject(new Error("Freelancer page load timed out"));
    }, timeoutMs);

    function onUpdated(updatedTabId: number, info: chrome.tabs.TabChangeInfo) {
      if (updatedTabId !== tabId || info.status !== "complete") return;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      setTimeout(() => resolve(), 900);
    }

    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.get(tabId).then((tab) => {
      if (tab.status === "complete") {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(onUpdated);
        setTimeout(() => resolve(), 900);
      }
    });
  });
}

function tabMatchesProject(
  tabUrl: string | undefined,
  freelancerProjectId: string | undefined,
  targetPath: string,
): boolean {
  if (!tabUrl) return false;
  if (freelancerProjectId && tabUrl.includes(freelancerProjectId)) return true;
  return normalizeProjectPath(tabUrl) === targetPath;
}

async function sendScrapeClarifications(
  tabId: number,
  payload: { helmProjectId: string },
): Promise<{ ok: boolean; clarifications?: unknown[]; count?: number; error?: string }> {
  let lastError = "Content script not ready";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, {
        type: "SCRAPE_CLARIFICATIONS",
        expandDom: true,
        helmProjectId: payload.helmProjectId,
      });
      if (response && typeof response === "object") return response;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      await new Promise((resolve) => setTimeout(resolve, 600 + attempt * 400));
    }
  }
  return { ok: false, error: lastError };
}

async function refreshClarifications(message: {
  projectId?: string;
  freelancerProjectId?: string;
  url?: string;
}): Promise<{ ok: boolean; clarifications?: unknown[]; count?: number; error?: string }> {
  const projectId = message.projectId?.trim();
  if (!projectId) return { ok: false, error: "Missing dashboard project id" };

  const rawUrl = message.url?.trim();
  const targetUrl =
    rawUrl ||
    (message.freelancerProjectId
      ? `https://www.freelancer.com/projects/${message.freelancerProjectId}/details`
      : "");
  if (!targetUrl) return { ok: false, error: "Missing Freelancer project URL" };

  const targetPath = normalizeProjectPath(targetUrl);
  const tabs = await chrome.tabs.query({
    url: ["*://www.freelancer.com/projects/*", "*://freelancer.com/projects/*"],
  });
  let tab = tabs.find((item) =>
    tabMatchesProject(item.url, message.freelancerProjectId, targetPath),
  );

  let createdTabId: number | null = null;
  if (!tab?.id) {
    tab = await chrome.tabs.create({ url: targetUrl, active: false });
    createdTabId = tab.id ?? null;
    if (!tab.id) return { ok: false, error: "Could not open Freelancer tab" };
    await waitForTabComplete(tab.id);
  }

  try {
    return await sendScrapeClarifications(tab.id, { helmProjectId: projectId });
  } finally {
    if (createdTabId != null) {
      chrome.tabs.remove(createdTabId).catch(() => {});
    }
  }
}

const DASHBOARD_TAB_PATTERNS = [
  "http://localhost:3001/*",
  "http://127.0.0.1:3001/*",
  "https://helm.drhelm.uk/*",
  "https://*.drhelm.uk/*",
  "https://*.vercel.app/*",
];

async function broadcastNewProjectsToDashboard(count: number): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({ url: DASHBOARD_TAB_PATTERNS });
    await Promise.all(
      tabs.map(async (tab) => {
        if (tab.id == null) return;
        try {
          await chrome.tabs.sendMessage(tab.id, { type: "NEW_PROJECTS", count });
        } catch {
          /* dashboard bridge not ready in this tab */
        }
      }),
    );
  } catch {
    /* tabs query failed */
  }
}

async function openBackgroundTab(
  url?: string,
  stayOnTabId?: number,
): Promise<{ ok: boolean; error?: string }> {
  const target = url?.trim();
  if (!target) return { ok: false, error: "Missing URL" };
  try {
    const parsed = new URL(target);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { ok: false, error: "Unsupported URL" };
    }
    await chrome.tabs.create({ url: parsed.href, active: false });
    if (stayOnTabId != null) {
      await chrome.tabs.update(stayOnTabId, { active: true }).catch(() => undefined);
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function handleExternalMessage(
  message: {
    type?: string;
    token?: string;
    apiUrl?: string;
    autoGenerate?: boolean;
    fillSubmitted?: boolean;
    project?: unknown;
    bid?: unknown;
    projectId?: string;
    freelancerProjectId?: string;
    url?: string;
  },
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void,
) {
  if (message?.type === "AUTH_TOKEN") {
    saveAuthToken(message);
    sendResponse({ ok: true });
    return true;
  }
  if (message?.type === "OPEN_PROJECT") {
    void saveDashboardHandoff(message).then((ok) => sendResponse({ ok }));
    return true;
  }
  if (message?.type === "OPEN_BACKGROUND_TAB") {
    void openBackgroundTab(message.url, sender.tab?.id).then(sendResponse);
    return true;
  }
  if (message?.type === "REFRESH_CLARIFICATIONS") {
    void refreshClarifications(message).then(sendResponse);
    return true;
  }
  return true;
}

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) =>
  handleExternalMessage(message, sender, sendResponse),
);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "AUTH_TOKEN") {
    saveAuthToken(message);
    sendResponse({ ok: true });
    return true;
  }
  if (message?.type === "OPEN_PROJECT") {
    void saveDashboardHandoff(message).then((ok) => sendResponse({ ok }));
    return true;
  }
  if (message?.type === "OPEN_BACKGROUND_TAB") {
    void openBackgroundTab(message.url, sender.tab?.id).then(sendResponse);
    return true;
  }
  if (message?.type === "REFRESH_CLARIFICATIONS") {
    void refreshClarifications(message).then(sendResponse);
    return true;
  }
  if (message?.type === "NEW_PROJECTS" && message.count > 0) {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: "Helm",
      message: `${message.count} new project(s) synced`,
    });
    void broadcastNewProjectsToDashboard(message.count);
  }
  return true;
});
