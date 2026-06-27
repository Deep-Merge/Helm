"use client";

import { useCallback, useState } from "react";
import { deleteProjectClient } from "@/lib/delete-project-client";

export function DeleteProjectButton({
  projectId,
  projectTitle,
  onDeleted,
  className = "",
}: {
  projectId: string;
  projectTitle: string;
  onDeleted?: (projectId: string) => void;
  className?: string;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    const label = projectTitle.trim() || "this project";
    if (!window.confirm(`Delete “${label}” from your dashboard?`)) return;

    setDeleting(true);
    try {
      const ok = await deleteProjectClient(projectId);
      if (!ok) {
        window.alert("Could not delete project.");
        return;
      }
      onDeleted?.(projectId);
    } finally {
      setDeleting(false);
    }
  }, [onDeleted, projectId, projectTitle]);

  return (
    <span
      className={className}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => void handleDelete()}
        disabled={deleting}
        aria-label={deleting ? "Deleting project" : "Delete project"}
        title={deleting ? "Deleting…" : "Delete project"}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-red-500/10 hover:text-red-300 disabled:pointer-events-none disabled:opacity-40"
      >
        {deleting ? (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border border-current border-t-transparent" />
        ) : (
          <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden>
            <path
              d="M3.5 4.5h9M6 4.5V3.75A1.25 1.25 0 0 1 7.25 2.5h1.5A1.25 1.25 0 0 1 10 3.75V4.5M5.5 4.5l.5 8h4l.5-8"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
    </span>
  );
}
