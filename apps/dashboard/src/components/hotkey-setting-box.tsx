"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  bindingConflict,
  DASHBOARD_HOTKEY_LABELS,
  DEFAULT_DASHBOARD_HOTKEYS,
  eventToBinding,
  formatHotkeyDisplay,
  readDashboardHotkeyBindings,
  resetDashboardHotkeyBinding,
  writeDashboardHotkeyBinding,
  type DashboardHotkeyAction,
} from "@/lib/dashboard-hotkeys";

function HotkeySettingRow({
  action,
  description,
}: {
  action: DashboardHotkeyAction;
  description?: string;
}) {
  const [binding, setBinding] = useState(() => DEFAULT_DASHBOARD_HOTKEYS[action]);
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<"error" | "info">("info");
  const captureRef = useRef<HTMLInputElement>(null);

  const reloadBinding = useCallback(() => {
    setBinding(readDashboardHotkeyBindings()[action]);
  }, [action]);

  useEffect(() => {
    reloadBinding();
  }, [reloadBinding]);

  useEffect(() => {
    function onUpdated() {
      reloadBinding();
    }
    window.addEventListener("bidautomation:dashboard-hotkeys-updated", onUpdated);
    return () => window.removeEventListener("bidautomation:dashboard-hotkeys-updated", onUpdated);
  }, [reloadBinding]);

  function showStatus(message: string, type: "error" | "info" = "info") {
    setStatus(message);
    setStatusType(type);
  }

  function stopRecording() {
    setRecording(false);
  }

  function startRecording() {
    setStatus(null);
    setRecording(true);
    window.setTimeout(() => {
      captureRef.current?.focus();
      captureRef.current?.select();
    }, 0);
  }

  useEffect(() => {
    if (!recording) return;

    function onCaptureKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        stopRecording();
        showStatus("Shortcut change cancelled.");
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const nextBinding = eventToBinding(event);
      if (!nextBinding) return;

      const bindings = readDashboardHotkeyBindings();
      const conflict = bindingConflict(nextBinding, bindings, action);
      if (conflict) {
        showStatus(
          `Already used for ${DASHBOARD_HOTKEY_LABELS[conflict]}. Try another shortcut.`,
          "error",
        );
        return;
      }

      writeDashboardHotkeyBinding(action, nextBinding);
      setBinding(nextBinding);
      stopRecording();
      showStatus(`Set to ${formatHotkeyDisplay(nextBinding)}.`);
    }

    document.addEventListener("keydown", onCaptureKeydown, true);
    return () => document.removeEventListener("keydown", onCaptureKeydown, true);
  }, [action, recording]);

  function handleReset() {
    stopRecording();
    resetDashboardHotkeyBinding(action);
    setBinding(DEFAULT_DASHBOARD_HOTKEYS[action]);
    showStatus("Reset to default.");
  }

  const title = DASHBOARD_HOTKEY_LABELS[action];

  return (
    <div className="border-t border-white/[0.06] pt-4 first:border-t-0 first:pt-0">
      <input
        ref={captureRef}
        type="text"
        readOnly
        aria-hidden
        tabIndex={-1}
        className="pointer-events-none absolute h-0 w-0 opacity-0"
      />

      <div className="mb-2">
        <p className="text-sm font-medium text-zinc-300">{title}</p>
        {description ? <p className="mt-0.5 text-xs text-zinc-600">{description}</p> : null}
      </div>

      {recording ? (
        <p className="mb-3 rounded-lg border border-indigo-400/30 bg-indigo-500/10 px-3 py-2 text-sm text-indigo-200">
          Press keys for <strong>{title}</strong> — Esc to cancel
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={startRecording}
          disabled={recording}
          className={`min-w-[10rem] rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
            recording
              ? "border-indigo-400/50 bg-indigo-500/15 text-indigo-100 ring-2 ring-indigo-400/40"
              : "border-[var(--border)] bg-white/[0.03] text-zinc-200 hover:border-white/20 hover:bg-white/[0.06]"
          }`}
        >
          {formatHotkeyDisplay(binding)}
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="text-sm text-zinc-500 transition hover:text-zinc-300"
        >
          Reset to default
        </button>
      </div>

      {status ? (
        <p
          className={`mt-2 text-sm ${statusType === "error" ? "text-red-400" : "text-zinc-500"}`}
          aria-live="polite"
        >
          {status}
        </p>
      ) : null}
    </div>
  );
}

export function HotkeySettingsPanel() {
  return (
    <section className="glass rounded-2xl p-6">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-zinc-500">
        Keyboard shortcuts
      </h2>
      <div className="space-y-4">
        <HotkeySettingRow
          action="copyProposal"
          description="On project detail, copies the proposal to your clipboard."
        />
        <HotkeySettingRow
          action="copyQuestions"
          description="On project detail, copies your questions to your clipboard."
        />
      </div>
    </section>
  );
}
