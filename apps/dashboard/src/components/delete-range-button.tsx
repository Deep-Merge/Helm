"use client";

import { useState } from "react";
import { formatDateRangeLabel, type DateRange } from "@/lib/date-range";
import { getBrowserTimezoneOffset } from "@/lib/date-range";

export function DeleteRangeButton({
  range,
  count,
  dateField = "seen",
  status,
  onDeleted,
}: {
  range: DateRange;
  count?: number;
  dateField?: "seen" | "submitted";
  status?: string;
  onDeleted?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const hasRange = Boolean(range.from || range.to);
  const label = formatDateRangeLabel(range);

  async function handleDelete() {
    if (!hasRange || busy) return;
    const countLabel = count != null ? `${count} project${count === 1 ? "" : "s"}` : "all projects";
    const confirmed = window.confirm(
      `Delete ${countLabel} in ${label}? This cannot be undone.`,
    );
    if (!confirmed) return;

    setBusy(true);
    try {
      const params = new URLSearchParams();
      if (range.from) params.set("date_from", range.from);
      params.set("date_to", range.to || range.from);
      params.set("tz_offset", String(getBrowserTimezoneOffset()));
      params.set("date_field", dateField);
      if (status) params.set("status", status);

      const res = await fetch(`/api/projects/delete-range?${params.toString()}`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(typeof data?.detail === "string" ? data.detail : "Could not delete that range.");
        return;
      }
      onDeleted?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleDelete()}
      disabled={!hasRange || busy}
      title={
        hasRange
          ? `Delete all projects in ${label}`
          : "Select a date range first"
      }
      className="h-9 shrink-0 rounded-lg px-3 text-[13px] font-medium text-rose-200 ring-1 ring-rose-400/25 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {busy ? "Deleting…" : "Delete range"}
    </button>
  );
}
