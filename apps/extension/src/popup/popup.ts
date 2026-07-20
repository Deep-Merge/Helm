import {
  ensureLocalDevSettings,
  friendlyApiError,
  getAnalytics,
  getProfile,
  getSettings,
  LOCAL_DEV_DEFAULTS,
  verifyApiConnection,
} from "../lib/api";
import { initHotkeyEditor } from "./hotkey-editor";

const DASHBOARD_URL = "http://localhost:3001";

function setHotkeyStatus(message: string, type: "error" | "info" = "info") {
  const el = document.getElementById("hotkey-status");
  if (!el) return;
  el.textContent = message;
  el.className = `popup__hotkey-status ${type === "error" ? "popup__hotkey-status--error" : ""}`;
}

async function refreshConnectionStatus(statusEl: HTMLElement) {
  const connection = await verifyApiConnection();
  if (connection.ok) {
    statusEl.textContent = "Connected to API";
    statusEl.className = "connected";
    return;
  }
  statusEl.textContent = connection.message;
  statusEl.className = "error";
}

async function init() {
  const settings = await ensureLocalDevSettings();
  const apiUrl = document.getElementById("api-url") as HTMLInputElement;
  const authToken = document.getElementById("auth-token") as HTMLInputElement;
  const watcher = document.getElementById("watcher") as HTMLInputElement;
  const statusEl = document.getElementById("connection-status")!;
  const connectLink = document.getElementById("connect-link") as HTMLAnchorElement;
  const dashboardLink = document.getElementById("dashboard") as HTMLAnchorElement;

  apiUrl.value = settings.apiUrl;
  authToken.value = settings.authToken;
  watcher.checked = settings.watcherEnabled;
  connectLink.href = `${DASHBOARD_URL}/connect-extension`;
  dashboardLink.href = DASHBOARD_URL;

  try {
    const stats = await getAnalytics();
    document.getElementById("stat-discovered")!.textContent = String(stats.projects_discovered ?? 0);
    document.getElementById("stat-submitted")!.textContent = String(stats.submitted ?? 0);
    document.getElementById("stat-rate")!.textContent = `${Math.round((stats.submission_rate ?? 0) * 100)}%`;
  } catch {
    document.getElementById("stat-discovered")!.textContent = "—";
    document.getElementById("stat-submitted")!.textContent = "—";
    document.getElementById("stat-rate")!.textContent = "—";
  }

  await refreshConnectionStatus(statusEl);
  await initHotkeyEditor(document, setHotkeyStatus);

  document.getElementById("save")!.addEventListener("click", async () => {
    const token = authToken.value.trim();
    await chrome.storage.local.set({
      apiUrl: apiUrl.value.trim() || LOCAL_DEV_DEFAULTS.apiUrl,
      authToken: token || settings.authToken,
      watcherEnabled: watcher.checked,
    });
    try {
      await getProfile();
      statusEl.textContent = "Saved and connected";
      statusEl.className = "connected";
    } catch (error) {
      statusEl.textContent = friendlyApiError(error);
      statusEl.className = "error";
    }
  });
}

init();
