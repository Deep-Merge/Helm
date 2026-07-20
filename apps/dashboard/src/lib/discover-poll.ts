const STORAGE_KEY = "bidautomation_discover_poll_sec";
const AUTO_REFRESH_KEY = "bidautomation_discover_auto_refresh";
export const DEFAULT_POLL_SEC = 30;
export const MIN_POLL_SEC = 30;
export const MAX_POLL_SEC = 600;

export const POLL_INTERVAL_OPTIONS = [
  { value: 30, label: "30 seconds" },
  { value: 60, label: "1 minute" },
  { value: 120, label: "2 minutes" },
  { value: 300, label: "5 minutes" },
  { value: 600, label: "10 minutes" },
] as const;

/** Select value when auto-refresh is off (not a poll interval). */
export const POLL_REFRESH_DISABLED_VALUE = 0;

export const POLL_REFRESH_SELECT_OPTIONS = [
  { value: POLL_REFRESH_DISABLED_VALUE, label: "Disable" },
  ...POLL_INTERVAL_OPTIONS,
] as const;

function envDefaultPollSec(): number {
  const raw = process.env.NEXT_PUBLIC_DISCOVER_POLL_SEC;
  const sec = raw ? Number.parseInt(raw, 10) : DEFAULT_POLL_SEC;
  if (!Number.isFinite(sec) || sec < MIN_POLL_SEC) return DEFAULT_POLL_SEC;
  return Math.min(sec, MAX_POLL_SEC);
}

export function clampPollIntervalSec(sec: number): number {
  if (!Number.isFinite(sec)) return envDefaultPollSec();
  return Math.min(MAX_POLL_SEC, Math.max(MIN_POLL_SEC, Math.round(sec)));
}

export function getDefaultPollIntervalSec(): number {
  return envDefaultPollSec();
}

export function readPollIntervalSec(): number {
  if (typeof window === "undefined") return getDefaultPollIntervalSec();
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored != null) {
      return clampPollIntervalSec(Number.parseInt(stored, 10));
    }
  } catch {
    /* ignore */
  }
  return getDefaultPollIntervalSec();
}

export function writePollIntervalSec(sec: number): number {
  const clamped = clampPollIntervalSec(sec);
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, String(clamped));
    } catch {
      /* ignore */
    }
  }
  return clamped;
}

export function pollIntervalMs(sec: number): number {
  return clampPollIntervalSec(sec) * 1000;
}

/** @deprecated use readPollIntervalSec */
export function discoverPollIntervalMs(): number {
  return pollIntervalMs(readPollIntervalSec());
}

export function formatPollIntervalLabel(sec: number): string {
  const match = POLL_INTERVAL_OPTIONS.find((o) => o.value === sec);
  return match?.label ?? `${sec} seconds`;
}

export function readAutoRefreshEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const stored = localStorage.getItem(AUTO_REFRESH_KEY);
    if (stored === "0" || stored === "false") return false;
    if (stored === "1" || stored === "true") return true;
  } catch {
    /* ignore */
  }
  return true;
}

export function writeAutoRefreshEnabled(enabled: boolean): boolean {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(AUTO_REFRESH_KEY, enabled ? "1" : "0");
    } catch {
      /* ignore */
    }
  }
  return enabled;
}
