"use strict";
// Bridges extension background events into the Helm dashboard page so the UI can
// refresh the instant the extension syncs new projects (no polling delay).
//
// The background worker sends a NEW_PROJECTS message to this dashboard tab; we
// relay it to the page via window.postMessage. The page listens for
// { source: "helm-extension", type: "NEW_PROJECTS" }.
chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "NEW_PROJECTS") {
        window.postMessage({
            source: "helm-extension",
            type: "NEW_PROJECTS",
            count: typeof message.count === "number" ? message.count : 0,
        }, window.location.origin);
    }
});
