"use strict";
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
    const patch = {};
    if (!current.apiUrl)
        patch.apiUrl = "http://127.0.0.1:8000";
    if (!current.authToken)
        patch.authToken = "dev-token";
    if (current.watcherEnabled === undefined)
        patch.watcherEnabled = true;
    if (!current.modelTier)
        patch.modelTier = "auto";
    if (!current.defaultDirection) {
        patch.defaultDirection = "Make it confident and human. Ask to discuss in Freelancer chat.";
    }
    if (Object.keys(patch).length) {
        await chrome.storage.local.set(patch);
    }
});
function saveAuthToken(message) {
    if (message.token) {
        chrome.storage.local.set({
            authToken: message.token,
            apiUrl: message.apiUrl || "http://localhost:8000",
        });
    }
}
async function saveDashboardHandoff(message) {
    if (!message?.project || typeof message.project !== "object")
        return false;
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
chrome.runtime.onMessageExternal.addListener((message, _sender, sendResponse) => {
    if (message?.type === "AUTH_TOKEN") {
        saveAuthToken(message);
        sendResponse({ ok: true });
        return true;
    }
    if (message?.type === "OPEN_PROJECT") {
        void saveDashboardHandoff(message).then((ok) => sendResponse({ ok }));
        return true;
    }
    return true;
});
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "AUTH_TOKEN") {
        saveAuthToken(message);
        sendResponse({ ok: true });
    }
    if (message?.type === "OPEN_PROJECT") {
        void saveDashboardHandoff(message).then((ok) => sendResponse({ ok }));
        return true;
    }
    if (message?.type === "NEW_PROJECTS" && message.count > 0) {
        chrome.notifications.create({
            type: "basic",
            iconUrl: "icons/icon128.png",
            title: "BidAutomation",
            message: `${message.count} new project(s) synced`,
        });
    }
    return true;
});
