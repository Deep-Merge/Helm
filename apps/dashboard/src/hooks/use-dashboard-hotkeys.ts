"use client";

import { useEffect, useRef } from "react";
import {
  DASHBOARD_HOTKEYS_UPDATED_EVENT,
  findDashboardActionForEvent,
  readDashboardHotkeyBindings,
} from "@/lib/dashboard-hotkeys";

export function useDashboardHotkeys(
  handlers: {
    onCopyProposal?: () => void;
    onCopyQuestions?: () => void;
  },
  options: { enabled?: boolean } = {},
) {
  const enabled = options.enabled ?? true;
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled) return;

    let bindings = readDashboardHotkeyBindings();

    function reloadBindings() {
      bindings = readDashboardHotkeyBindings();
    }

    function onKeydown(event: KeyboardEvent) {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return;
      }

      const action = findDashboardActionForEvent(event, bindings);
      if (!action) return;

      event.preventDefault();
      event.stopPropagation();
      if (action === "copyProposal") handlersRef.current.onCopyProposal?.();
      else if (action === "copyQuestions") handlersRef.current.onCopyQuestions?.();
    }

    document.addEventListener("keydown", onKeydown, true);
    window.addEventListener(DASHBOARD_HOTKEYS_UPDATED_EVENT, reloadBindings);
    return () => {
      document.removeEventListener("keydown", onKeydown, true);
      window.removeEventListener(DASHBOARD_HOTKEYS_UPDATED_EVENT, reloadBindings);
    };
  }, [enabled]);
}
