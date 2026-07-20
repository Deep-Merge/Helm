export type DashboardHotkeyAction = "copyProposal" | "copyQuestions";

export type DashboardHotkeyBindings = Record<DashboardHotkeyAction, string>;

const STORAGE_PREFIX = "bidautomation_dashboard_hotkey_";

export const DASHBOARD_HOTKEY_STORAGE_KEYS: Record<DashboardHotkeyAction, string> = {
  copyProposal: `${STORAGE_PREFIX}copy_proposal`,
  copyQuestions: `${STORAGE_PREFIX}copy_questions`,
};

export const DEFAULT_DASHBOARD_HOTKEYS: DashboardHotkeyBindings = {
  copyProposal: "alt+shift+keyp",
  copyQuestions: "alt+shift+keyq",
};

export const DASHBOARD_HOTKEY_LABELS: Record<DashboardHotkeyAction, string> = {
  copyProposal: "Copy proposal",
  copyQuestions: "Copy questions",
};

export const DASHBOARD_HOTKEYS_UPDATED_EVENT = "bidautomation:dashboard-hotkeys-updated";

const MODIFIER_CODES = new Set([
  "controlleft",
  "controlright",
  "shiftleft",
  "shiftright",
  "altleft",
  "altright",
  "metaleft",
  "metaright",
]);

function normalizeBinding(binding: string): string {
  return binding.trim().toLowerCase();
}

function isActionKeyCode(code: string): boolean {
  const key = code.toLowerCase();
  if (MODIFIER_CODES.has(key)) return false;
  return (
    key.startsWith("key") ||
    key.startsWith("digit") ||
    key.startsWith("numpad") ||
    /^f\d+$/.test(key) ||
    ["comma", "period", "slash", "backslash", "minus", "equal", "bracketleft", "bracketright"].includes(
      key,
    )
  );
}

export function readDashboardHotkeyBindings(): DashboardHotkeyBindings {
  if (typeof window === "undefined") {
    return { ...DEFAULT_DASHBOARD_HOTKEYS };
  }

  return {
    copyProposal: normalizeBinding(
      localStorage.getItem(DASHBOARD_HOTKEY_STORAGE_KEYS.copyProposal) ||
        DEFAULT_DASHBOARD_HOTKEYS.copyProposal,
    ),
    copyQuestions: normalizeBinding(
      localStorage.getItem(DASHBOARD_HOTKEY_STORAGE_KEYS.copyQuestions) ||
        DEFAULT_DASHBOARD_HOTKEYS.copyQuestions,
    ),
  };
}

export function writeDashboardHotkeyBinding(
  action: DashboardHotkeyAction,
  binding: string,
): void {
  localStorage.setItem(DASHBOARD_HOTKEY_STORAGE_KEYS[action], normalizeBinding(binding));
  window.dispatchEvent(new CustomEvent(DASHBOARD_HOTKEYS_UPDATED_EVENT));
}

export function resetDashboardHotkeyBinding(action: DashboardHotkeyAction): void {
  localStorage.setItem(
    DASHBOARD_HOTKEY_STORAGE_KEYS[action],
    DEFAULT_DASHBOARD_HOTKEYS[action],
  );
  window.dispatchEvent(new CustomEvent(DASHBOARD_HOTKEYS_UPDATED_EVENT));
}

export function eventToBinding(event: KeyboardEvent): string | null {
  if (event.key === "Escape" || event.key === "Tab") return null;
  if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) return null;

  const code = event.code.toLowerCase();
  if (!isActionKeyCode(code)) return null;

  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) parts.push("mod");
  if (event.altKey) parts.push("alt");
  if (event.shiftKey) parts.push("shift");
  parts.push(code);
  return parts.join("+");
}

export function matchesHotkey(event: KeyboardEvent, binding: string): boolean {
  const pressed = eventToBinding(event);
  return !!pressed && pressed === normalizeBinding(binding);
}

export function formatHotkeyDisplay(binding: string): string {
  const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);
  return normalizeBinding(binding)
    .split("+")
    .map((part) => {
      if (part === "mod") return isMac ? "⌘" : "Ctrl";
      if (part === "alt") return isMac ? "Option" : "Alt";
      if (part === "shift") return "Shift";
      if (part.startsWith("key") && part.length === 4) return part.slice(3).toUpperCase();
      if (part.startsWith("digit")) return part.slice(5);
      if (part.startsWith("numpad")) return `Num ${part.slice(6)}`;
      return part;
    })
    .join("+");
}

export function bindingConflict(
  binding: string,
  bindings: DashboardHotkeyBindings,
  except?: DashboardHotkeyAction,
): DashboardHotkeyAction | null {
  const normalized = normalizeBinding(binding);
  for (const action of Object.keys(bindings) as DashboardHotkeyAction[]) {
    if (except && action === except) continue;
    if (normalizeBinding(bindings[action]) === normalized) return action;
  }
  return null;
}

export function findDashboardActionForEvent(
  event: KeyboardEvent,
  bindings: DashboardHotkeyBindings,
): DashboardHotkeyAction | null {
  if (matchesHotkey(event, bindings.copyProposal)) return "copyProposal";
  if (matchesHotkey(event, bindings.copyQuestions)) return "copyQuestions";
  return null;
}
