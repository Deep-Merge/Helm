"use client";

import { useLayoutEffect } from "react";

const LOCK_CLASS = "dashboard-lock-scroll";

export function LockViewportScroll() {
  useLayoutEffect(() => {
    const html = document.documentElement;
    html.classList.add(LOCK_CLASS);
    return () => {
      html.classList.remove(LOCK_CLASS);
    };
  }, []);

  return null;
}
