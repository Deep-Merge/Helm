"use client";

import { useCallback, useState } from "react";
import type { Project } from "@/lib/api";
import { updateProjectStatusClient } from "@/lib/discover-client";
import { pipelineStatus } from "@/lib/project-status";

export function ToggleSubmittedButton({
  project,
  onToggled,
  onMarkedSubmitted,
  className = "",
  variant = "icon",
}: {
  project: Pick<Project, "id" | "status">;
  onToggled?: (projectId: string, status: "viewed" | "submitted") => void;
  onMarkedSubmitted?: () => void;
  className?: string;
  variant?: "icon" | "pill";
}) {
  const [busy, setBusy] = useState(false);
  const isSubmitted = pipelineStatus(project.status) === "submitted";

  const handleToggle = useCallback(async () => {
    const nextStatus = isSubmitted ? "viewed" : "submitted";
    setBusy(true);
    onToggled?.(project.id, nextStatus);
    try {
      const ok = await updateProjectStatusClient(project.id, nextStatus);
      if (!ok) {
        onToggled?.(project.id, isSubmitted ? "submitted" : "viewed");
      } else if (nextStatus === "submitted") {
        onMarkedSubmitted?.();
      }
    } finally {
      setBusy(false);
    }
  }, [isSubmitted, onMarkedSubmitted, onToggled, project.id]);

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={() => void handleToggle()}
        disabled={busy}
        aria-label={isSubmitted ? "Mark as not submitted" : "Mark as submitted"}
        aria-pressed={isSubmitted}
        title={
          isSubmitted
            ? "You marked this as submitted — click to undo"
            : "Mark as submitted after you place your bid on Freelancer"
        }
        className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition disabled:pointer-events-none disabled:opacity-50 ${
          isSubmitted
            ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/40 hover:bg-emerald-500/30"
            : "bg-white/[0.04] text-zinc-200 ring-1 ring-white/10 hover:bg-white/[0.08] hover:text-white"
        } ${className}`}
      >
        {busy ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 shrink-0" aria-hidden>
            <path
              d="M3.5 8.25 6.25 11l6.25-6.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
        {isSubmitted ? "Submitted" : "Mark submitted"}
      </button>
    );
  }

  return (
    <span
      className={className}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => void handleToggle()}
        disabled={busy}
        aria-label={isSubmitted ? "Mark as not submitted" : "Mark as submitted"}
        aria-pressed={isSubmitted}
        title={isSubmitted ? "Mark as seen (not submitted)" : "Mark as submitted"}
        className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition disabled:pointer-events-none disabled:opacity-40 ${
          isSubmitted
            ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/35 hover:bg-emerald-500/30"
            : "text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300"
        }`}
      >
        {busy ? (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border border-current border-t-transparent" />
        ) : (
          <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden>
            <path
              d="M3.5 8.25 6.25 11l6.25-6.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
    </span>
  );
}
