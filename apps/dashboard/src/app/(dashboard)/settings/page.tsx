"use client";

import { useEffect, useState, type ReactNode } from "react";
import { PageHeader } from "@/components/layout";
import { AccountSection } from "@/components/account-section";
import { HotkeySettingsPanel } from "@/components/hotkey-setting-box";
import Link from "next/link";

const MODEL_OPTIONS = [
  { value: "gpt-4.1", label: "GPT-4.1 — premium quality, fast (recommended)" },
  { value: "gpt-4.1-mini", label: "GPT-4.1 mini — faster, lighter" },
  { value: "gpt-4o", label: "GPT-4o — balanced" },
  { value: "gpt-4o-mini", label: "GPT-4o mini — fastest, cheapest" },
  { value: "gpt-5", label: "GPT-5 — highest quality, slower" },
];

function StyledSelect({
  value,
  onChange,
  children,
  "aria-label": ariaLabel,
}: {
  value: string | number;
  onChange: (value: string) => void;
  children: ReactNode;
  "aria-label"?: string;
}) {
  return (
    <div className="group relative">
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full cursor-pointer appearance-none rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 pr-11 text-sm font-medium text-zinc-200 shadow-sm outline-none transition-colors hover:border-white/20 hover:bg-white/[0.05] focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/25 [&>option]:bg-zinc-900 [&>option]:text-zinc-200"
      >
        {children}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 transition-colors group-hover:text-zinc-300"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}

function NumberStepper({
  value,
  min,
  max,
  onChange,
  "aria-label": ariaLabel,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  "aria-label"?: string;
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  const step = (delta: number) => onChange(clamp(Math.round((value || 0) + delta)));

  return (
    <div className="inline-flex items-stretch overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] shadow-sm transition-colors focus-within:border-indigo-500/70 focus-within:ring-2 focus-within:ring-indigo-500/25 hover:border-white/20">
      <input
        type="number"
        aria-label={ariaLabel}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
        className="w-16 bg-transparent px-4 py-2.5 text-center text-sm font-medium text-zinc-200 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <div className="flex flex-col border-l border-white/10">
        <button
          type="button"
          aria-label="Increase"
          onClick={() => step(1)}
          disabled={value >= max}
          className="flex flex-1 items-center justify-center px-2.5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 15 6-6 6 6" />
          </svg>
        </button>
        <div className="h-px bg-white/10" />
        <button
          type="button"
          aria-label="Decrease"
          onClick={() => step(-1)}
          disabled={value <= min}
          className="flex flex-1 items-center justify-center px-2.5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>
    </div>
  );
}


export default function SettingsPage() {
  const [displayName, setDisplayName] = useState("");
  const [bidRules, setBidRules] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [cleanupDays, setCleanupDays] = useState(30);
  const [cleaning, setCleaning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<string | null>(null);

  const [questionCount, setQuestionCount] = useState(3);
  const [proposalModel, setProposalModel] = useState("gpt-4.1");
  const [genSaved, setGenSaved] = useState(false);

  async function saveGenerationSetting(patch: Record<string, unknown>) {
    try {
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      setGenSaved(true);
      setTimeout(() => setGenSaved(false), 2000);
    } catch {
      /* ignore transient save errors */
    }
  }

  function handleQuestionCountChange(value: number) {
    setQuestionCount(value);
    void saveGenerationSetting({ question_count: value });
  }

  function handleProposalModelChange(value: string) {
    setProposalModel(value);
    void saveGenerationSetting({ proposal_model: value });
  }

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        if (d.profile) {
          setDisplayName(d.profile.display_name || "");
          setBidRules(d.profile.default_direction || "");
          if (d.profile.question_count === 2 || d.profile.question_count === 3) {
            setQuestionCount(d.profile.question_count);
          }
          if (typeof d.profile.proposal_model === "string" && d.profile.proposal_model) {
            setProposalModel(d.profile.proposal_model);
          }
        }
      })
      .catch(() => {
        setLoadError(true);
      });
  }, []);

  async function save() {
    const trimmed = bidRules.trim();
    if (!trimmed) {
      setValidationError("Bid rules are required.");
      return;
    }

    setValidationError(null);
    setSaving(true);
    setSaved(false);
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name: displayName.trim(),
        default_direction: trimmed,
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function cleanupOldProjects() {
    const days = Math.max(1, Math.min(365, Math.round(cleanupDays || 0)));
    const confirmed = window.confirm(
      `Delete unsubmitted projects older than ${days} day${days === 1 ? "" : "s"}? ` +
        "Submitted, won, and lost projects are kept. This cannot be undone.",
    );
    if (!confirmed) return;

    setCleaning(true);
    setCleanupResult(null);
    try {
      const res = await fetch(`/api/projects/cleanup?days=${days}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setCleanupResult(data?.detail || "Cleanup failed. Please try again.");
        return;
      }
      const deleted = data?.deleted ?? 0;
      setCleanupResult(
        deleted === 0
          ? "No old unsubmitted projects to delete."
          : `Deleted ${deleted} old project${deleted === 1 ? "" : "s"}.`,
      );
    } catch {
      setCleanupResult("Cleanup failed. Please try again.");
    } finally {
      setCleaning(false);
    }
  }

  if (loadError) {
    return <div className="text-sm text-zinc-500">Could not load settings.</div>;
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="Bid rules, keyboard shortcuts, and extension connection."
      />

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="space-y-6">
          <AccountSection />
          <HotkeySettingsPanel />

          <section className="glass rounded-2xl p-6">
            <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-zinc-500">
              Extension
            </h2>
            <p className="mb-4 text-sm text-zinc-400">
              Connect your Chrome extension to sync bids with this account.
            </p>
            <Link
              href="/connect-extension"
              className="inline-block rounded-xl bg-white/5 px-5 py-2.5 text-sm font-medium text-indigo-300 ring-1 ring-white/10 hover:bg-white/10"
            >
              Connect extension →
            </Link>
          </section>

          <section className="glass rounded-2xl p-6">
            <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-zinc-500">
              Proposal automation
            </h2>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <p className="text-sm font-medium text-zinc-200">Generate on open</p>
              <p className="mt-1 text-sm text-zinc-400">
                Open a project with{" "}
                <kbd className="rounded-md border border-white/15 bg-white/[0.06] px-1.5 py-0.5 text-xs font-medium text-zinc-200">
                  Alt
                </kbd>{" "}
                + click to open it in a background tab and auto-generate its
                proposal and questions. Stay on the project list. Requires the
                Helm Chrome extension. A normal click (or Ctrl-click) just opens
                the project without generating.
              </p>
            </div>

            <div className="mt-5 grid gap-4 border-t border-white/10 pt-5 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-200">
                  Questions to ask
                </label>
                <p className="mb-2 text-xs text-zinc-500">
                  How many client questions each proposal includes.
                </p>
                <StyledSelect
                  aria-label="Questions to ask"
                  value={questionCount}
                  onChange={(v) => handleQuestionCountChange(Number(v))}
                >
                  <option value={2}>2 questions</option>
                  <option value={3}>3 questions</option>
                </StyledSelect>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-200">
                  AI model
                </label>
                <p className="mb-2 text-xs text-zinc-500">
                  Model used to write proposals and questions.
                </p>
                <StyledSelect
                  aria-label="AI model"
                  value={proposalModel}
                  onChange={handleProposalModelChange}
                >
                  {MODEL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </StyledSelect>
              </div>
            </div>
            {genSaved ? (
              <p className="mt-3 text-xs text-emerald-400">Saved ✓</p>
            ) : null}
          </section>

          <section className="glass rounded-2xl p-6">
            <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-zinc-500">
              Clean up projects
            </h2>
            <p className="mb-4 text-sm text-zinc-400">
              Delete unsubmitted projects older than the set number of days to keep your
              database small. Submitted, won, and lost projects are always kept.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Older than (days)</label>
                <NumberStepper
                  aria-label="Older than (days)"
                  min={1}
                  max={365}
                  value={cleanupDays}
                  onChange={setCleanupDays}
                />
              </div>
              <button
                type="button"
                onClick={cleanupOldProjects}
                disabled={cleaning}
                className="rounded-xl bg-red-500/90 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                {cleaning ? "Deleting…" : "Delete old projects"}
              </button>
            </div>
            {cleanupResult ? (
              <p className="mt-3 text-xs text-zinc-400">{cleanupResult}</p>
            ) : null}
          </section>
        </div>

        <section className="glass flex min-h-[32rem] flex-col rounded-2xl p-6 lg:min-h-[calc(100vh-12rem)]">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-zinc-500">
            Bid rules
          </h2>
          <div className="flex min-h-0 flex-1 flex-col space-y-4 text-sm">
            <div>
              <label className="mb-1 block text-zinc-500">Display name</label>
              <p className="mb-2 text-xs text-zinc-600">
                Used to sign off your proposals (e.g. Kareem).
              </p>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-white/[0.03] px-4 py-2.5 text-zinc-300 outline-none focus:border-indigo-500"
                placeholder="Your name"
              />
            </div>
            <div className="flex min-h-0 flex-1 flex-col">
              <label className="mb-1 block text-zinc-500">
                Bid rules <span className="text-red-400">*</span>
              </label>
              <p className="mb-2 text-xs text-zinc-600">
                Controls how proposals, questions, budget, and timeline are generated.
              </p>
              <textarea
                required
                value={bidRules}
                onChange={(e) => {
                  setBidRules(e.target.value);
                  if (validationError && e.target.value.trim()) {
                    setValidationError(null);
                  }
                }}
                className="min-h-[24rem] w-full flex-1 resize-y rounded-xl border border-[var(--border)] bg-white/[0.03] px-4 py-2.5 text-zinc-300 outline-none focus:border-indigo-500 lg:min-h-0"
                placeholder="How to write proposals, suggest budget, timeline, and client questions…"
              />
              {validationError ? (
                <p className="mt-2 text-xs text-red-400">{validationError}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="shrink-0 self-start rounded-xl bg-indigo-500 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
            >
              {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
