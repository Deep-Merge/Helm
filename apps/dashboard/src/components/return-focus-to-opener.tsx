"use client";

import { useLayoutEffect } from "react";

/** When opened via Alt+click (?stay=1), immediately give focus back to the project list. */
export function ReturnFocusToOpener({ enabled }: { enabled: boolean }) {
  useLayoutEffect(() => {
    if (!enabled) return;
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.focus();
      }
    } catch {
      /* ignore */
    }
    const url = new URL(window.location.href);
    if (url.searchParams.has("stay")) {
      url.searchParams.delete("stay");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, [enabled]);

  return null;
}
