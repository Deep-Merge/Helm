"use client";

import { useCallback, useState } from "react";
import type { Project } from "@/lib/api";
import { updateProjectStatusClient } from "@/lib/discover-client";
import { pipelineStatus } from "@/lib/project-status";

export function ToggleSubmittedButton({
  project,
  onToggled,
  className = "",
}: {
  project: Pick<Project, "id" | "status">;
  onToggled?: (projectId: string, status: "viewed" | "submitted") => void;
  className?: string;
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
      }
    } finally {
      setBusy(false);
    }
  }, [isSubmitted, onToggled, project.id]);

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
