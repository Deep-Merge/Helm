const DESKTOP_NOTIFICATIONS_KEY = "bidautomation_desktop_notifications";

export type NotificationPermissionState = "unsupported" | "default" | "granted" | "denied";

export function isDesktopNotificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getNotificationPermissionState(): NotificationPermissionState {
  if (!isDesktopNotificationsSupported()) return "unsupported";
  return Notification.permission;
}

export function readDesktopNotificationsEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const stored = localStorage.getItem(DESKTOP_NOTIFICATIONS_KEY);
    if (stored === "0" || stored === "false") return false;
    if (stored === "1" || stored === "true") return true;
    localStorage.setItem(DESKTOP_NOTIFICATIONS_KEY, "1");
  } catch {
    /* ignore */
  }
  return true;
}

export function writeDesktopNotificationsEnabled(enabled: boolean): boolean {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(DESKTOP_NOTIFICATIONS_KEY, enabled ? "1" : "0");
    } catch {
      /* ignore */
    }
  }
  return enabled;
}

export function canShowDesktopNotifications(): boolean {
  return (
    readDesktopNotificationsEnabled() &&
    getNotificationPermissionState() === "granted"
  );
}

export async function requestDesktopNotificationPermission(): Promise<NotificationPermissionState> {
  if (!isDesktopNotificationsSupported()) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return "denied";
  }
}

export function notifyNewProjectsDiscovered({
  count,
  titles = [],
  findUrl = "/find",
}: {
  count: number;
  titles?: string[];
  findUrl?: string;
}): void {
  if (count <= 0 || !canShowDesktopNotifications()) return;

  const title =
    count === 1
      ? "New project matches your filters"
      : `${count} new projects match your filters`;

  let body = "Open Find projects to review them on your list.";
  if (titles.length === 1) {
    body = titles[0];
  } else if (titles.length > 1) {
    const preview = titles.slice(0, 2).join(" · ");
    const extra = count > titles.length ? ` (+${count - titles.length} more)` : "";
    body = `${preview}${extra}`;
  }

  try {
    const notification = new Notification(title, {
      body,
      tag: "bidautomation-new-projects",
      silent: false,
    });
    notification.onclick = () => {
      window.focus();
      const target = findUrl.startsWith("/") ? findUrl : "/find";
      if (window.location.pathname + window.location.search !== target) {
        window.location.href = target;
      }
      notification.close();
    };
  } catch {
    /* ignore — e.g. blocked in insecure context */
  }
}
