export type HotkeyAction = "copyProposal" | "copyQuestions" | "fillForm";

export type HotkeyBindings = Record<HotkeyAction, string>;

export const HOTKEY_STORAGE_KEYS: Record<HotkeyAction, string> = {
  copyProposal: "hotkeyCopyProposal",
  copyQuestions: "hotkeyCopyQuestions",
  fillForm: "hotkeyFillForm",
};

/** Alt+Shift avoids Chrome reserved shortcuts (Ctrl+Shift+P = command palette, etc.) */
export const DEFAULT_HOTKEYS: HotkeyBindings = {
  copyProposal: "alt+shift+keyp",
  copyQuestions: "alt+shift+keyq",
  fillForm: "alt+shift+keyf",
};

export const HOTKEY_LABELS: Record<HotkeyAction, string> = {
  copyProposal: "Copy proposal",
  copyQuestions: "Copy questions",
  fillForm: "Fill form",
};

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

export async function readHotkeyBindings(): Promise<HotkeyBindings> {
  const stored = await chrome.storage.local.get(Object.values(HOTKEY_STORAGE_KEYS));
  return {
    copyProposal: normalizeBinding(
      (stored[HOTKEY_STORAGE_KEYS.copyProposal] as string) || DEFAULT_HOTKEYS.copyProposal,
    ),
    copyQuestions: normalizeBinding(
      (stored[HOTKEY_STORAGE_KEYS.copyQuestions] as string) || DEFAULT_HOTKEYS.copyQuestions,
    ),
    fillForm: normalizeBinding(
      (stored[HOTKEY_STORAGE_KEYS.fillForm] as string) || DEFAULT_HOTKEYS.fillForm,
    ),
  };
}

export async function writeHotkeyBinding(action: HotkeyAction, binding: string): Promise<void> {
  await chrome.storage.local.set({
    [HOTKEY_STORAGE_KEYS[action]]: normalizeBinding(binding),
  });
}

export async function resetHotkeyBindings(): Promise<void> {
  await chrome.storage.local.set({
    [HOTKEY_STORAGE_KEYS.copyProposal]: DEFAULT_HOTKEYS.copyProposal,
    [HOTKEY_STORAGE_KEYS.copyQuestions]: DEFAULT_HOTKEYS.copyQuestions,
    [HOTKEY_STORAGE_KEYS.fillForm]: DEFAULT_HOTKEYS.fillForm,
  });
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

export function findActionForEvent(
  event: KeyboardEvent,
  bindings: HotkeyBindings,
): HotkeyAction | null {
  if (matchesHotkey(event, bindings.copyProposal)) return "copyProposal";
  if (matchesHotkey(event, bindings.copyQuestions)) return "copyQuestions";
  if (matchesHotkey(event, bindings.fillForm)) return "fillForm";
  return null;
}

export function bindingConflict(
  binding: string,
  bindings: HotkeyBindings,
  except?: HotkeyAction,
): HotkeyAction | null {
  const normalized = normalizeBinding(binding);
  for (const action of Object.keys(bindings) as HotkeyAction[]) {
    if (except && action === except) continue;
    if (normalizeBinding(bindings[action]) === normalized) return action;
  }
  return null;
}
