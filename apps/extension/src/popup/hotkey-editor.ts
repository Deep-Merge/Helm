import {
  bindingConflict,
  DEFAULT_HOTKEYS,
  eventToBinding,
  formatHotkeyDisplay,
  HOTKEY_LABELS,
  readHotkeyBindings,
  resetHotkeyBindings,
  writeHotkeyBinding,
  type HotkeyAction,
  type HotkeyBindings,
} from "../lib/hotkeys";

export async function initHotkeyEditor(
  root: ParentNode,
  onStatus?: (message: string, type?: "error" | "info") => void,
) {
  let bindings = await readHotkeyBindings();
  let recordingAction: HotkeyAction | null = null;

  const captureInput = root.querySelector<HTMLInputElement>("#hotkey-capture");
  const recordingBanner = root.querySelector<HTMLElement>("#hotkey-recording");
  const recordingLabel = root.querySelector<HTMLElement>("#hotkey-recording-label");

  function setStatus(message: string, type: "error" | "info" = "info") {
    onStatus?.(message, type);
  }

  function renderHotkeyButtons() {
    for (const button of Array.from(root.querySelectorAll<HTMLButtonElement>("[data-hotkey-action]"))) {
      const action = button.dataset.hotkeyAction as HotkeyAction;
      button.textContent = formatHotkeyDisplay(bindings[action]);
      button.classList.remove("hotkey-row__value--recording");
      button.disabled = !!recordingAction && recordingAction !== action;
    }
  }

  function stopRecording() {
    recordingAction = null;
    captureInput?.removeEventListener("keydown", onCaptureKeydown, true);
    document.removeEventListener("keydown", onCaptureKeydown, true);
    recordingBanner?.classList.add("hotkey-recording--hidden");
    renderHotkeyButtons();
  }

  async function onCaptureKeydown(event: KeyboardEvent) {
    if (!recordingAction) return;

    if (event.key === "Escape") {
      event.preventDefault();
      stopRecording();
      setStatus("Hotkey change cancelled.");
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const binding = eventToBinding(event);
    if (!binding) return;

    const conflict = bindingConflict(binding, bindings, recordingAction);
    if (conflict) {
      setStatus(`Already used for ${HOTKEY_LABELS[conflict]}. Try another shortcut.`, "error");
      return;
    }

    const action = recordingAction;
    stopRecording();
    await writeHotkeyBinding(action, binding);
    bindings = { ...bindings, [action]: binding };
    renderHotkeyButtons();
    setStatus(`${HOTKEY_LABELS[action]} set to ${formatHotkeyDisplay(binding)}.`);
  }

  function startRecording(action: HotkeyAction, button: HTMLButtonElement) {
    stopRecording();
    recordingAction = action;
    recordingLabel!.textContent = HOTKEY_LABELS[action];
    recordingBanner?.classList.remove("hotkey-recording--hidden");
    button.classList.add("hotkey-row__value--recording");
    renderHotkeyButtons();
    button.classList.add("hotkey-row__value--recording");

    window.setTimeout(() => {
      captureInput?.focus();
      captureInput?.select();
    }, 0);

    captureInput?.addEventListener("keydown", onCaptureKeydown, true);
    document.addEventListener("keydown", onCaptureKeydown, true);
  }

  renderHotkeyButtons();

  for (const button of Array.from(root.querySelectorAll<HTMLButtonElement>("[data-hotkey-action]"))) {
    button.addEventListener("click", () => {
      startRecording(button.dataset.hotkeyAction as HotkeyAction, button);
    });
  }

  root.querySelector("#hotkey-reset")?.addEventListener("click", async () => {
    stopRecording();
    await resetHotkeyBindings();
    bindings = { ...DEFAULT_HOTKEYS };
    renderHotkeyButtons();
    setStatus("Hotkeys reset to default.");
  });
}
