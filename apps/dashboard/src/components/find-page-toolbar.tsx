"use client";

import { useDiscoverMonitor } from "@/components/discover-monitor";
import { FilterSelect } from "@/components/filter-field";
import { FindListViewToggle } from "@/components/find-list-view-toggle";
import {
  POLL_REFRESH_DISABLED_VALUE,
  POLL_REFRESH_SELECT_OPTIONS,
} from "@/lib/discover-poll";
import type { FindListViewMode } from "@/lib/find-list-view";

const REFRESH_OPTIONS = POLL_REFRESH_SELECT_OPTIONS.map((o) => ({
  value: String(o.value),
  label: o.label,
}));

export function FindPageToolbar({
  onRefresh,
  loading,
  listView = "long",
  onListViewChange,
}: {
  onRefresh: () => void;
  loading: boolean;
  listView?: FindListViewMode;
  onListViewChange?: (mode: FindListViewMode) => void;
}) {
  const {
    pollIntervalSec,
    setPollIntervalSec,
    autoRefreshEnabled,
    setAutoRefreshEnabled,
    desktopNotificationsEnabled,
    setDesktopNotificationsEnabled,
    notificationPermission,
    state,
  } = useDiscoverMonitor();
  const busy = loading || state.polling;

  const alertsBlocked = notificationPermission === "denied";
  const alertsUnsupported = notificationPermission === "unsupported";
  const alertsPending =
    desktopNotificationsEnabled &&
    !alertsBlocked &&
    !alertsUnsupported &&
    notificationPermission === "default";

  const refreshSelectValue = autoRefreshEnabled
    ? String(pollIntervalSec)
    : String(POLL_REFRESH_DISABLED_VALUE);

  function handleRefreshSelectChange(value: string) {
    if (value === String(POLL_REFRESH_DISABLED_VALUE)) {
      setAutoRefreshEnabled(false);
      return;
    }
    setAutoRefreshEnabled(true);
    setPollIntervalSec(Number(value));
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {onListViewChange && (
        <FindListViewToggle value={listView} onChange={onListViewChange} />
      )}
      <button
        type="button"
        onClick={() => void setDesktopNotificationsEnabled(!desktopNotificationsEnabled)}
        disabled={alertsUnsupported}
        title={
          alertsUnsupported
            ? "Desktop notifications are not supported in this browser"
            : alertsBlocked
              ? "Notifications blocked — allow them in browser settings, then click Alerts"
              : alertsPending
                ? "Alerts enabled — allow notifications when your browser prompts"
                : desktopNotificationsEnabled
                  ? "Disable desktop alerts for matching new projects"
                  : "Enable desktop alerts for matching new projects"
        }
        className={`rounded-xl px-3 py-2 text-sm font-medium ring-1 transition disabled:cursor-not-allowed disabled:opacity-40 ${
          desktopNotificationsEnabled && !alertsBlocked
            ? "bg-amber-500/15 text-amber-300 ring-amber-500/30 hover:bg-amber-500/20"
            : "bg-white/5 text-zinc-400 ring-white/10 hover:bg-white/10 hover:text-zinc-300"
        }`}
        aria-pressed={desktopNotificationsEnabled}
        aria-label={
          desktopNotificationsEnabled ? "Disable desktop alerts" : "Enable desktop alerts"
        }
      >
        Alerts {desktopNotificationsEnabled ? (alertsBlocked ? "blocked" : "on") : "off"}
      </button>
      <FilterSelect
        value={refreshSelectValue}
        onChange={handleRefreshSelectChange}
        options={REFRESH_OPTIONS}
        size="toolbar"
        aria-label="Auto-refresh interval"
        className="w-[8.75rem]"
      />
      <button
        type="button"
        onClick={onRefresh}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Refresh projects now"
        aria-busy={loading}
      >
        <svg
          viewBox="0 0 20 20"
          className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          aria-hidden
        >
          <path
            d="M17 10a7 7 0 1 1-1.45-4.25M17 3v4h-4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {loading ? "Refreshing…" : "Refresh"}
      </button>
    </div>
  );
}
