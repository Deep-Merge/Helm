"use client";

export function ProposalGeneratingTopBar({ percent }: { percent: number }) {
  const clamped = Math.max(4, Math.min(100, percent));

  return (
    <div
      className="relative h-1 w-full overflow-hidden rounded-full bg-white/[0.06]"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      aria-label="Generating proposal"
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-indigo-400 via-violet-400 to-indigo-300 shadow-[0_0_16px_rgba(129,140,248,0.65)] transition-[width] duration-300 ease-out"
        style={{ width: `${clamped}%` }}
      />
      <div
        className="pointer-events-none absolute inset-y-0 w-24 animate-[proposal-shimmer_1.6s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/35 to-transparent"
        style={{ left: `${Math.max(0, clamped - 18)}%` }}
        aria-hidden
      />
    </div>
  );
}

export function ProposalGeneratingPanel({ label, percent }: { label: string; percent: number }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 px-6 py-10">
      <div className="relative">
        <div
          className="h-14 w-14 animate-spin rounded-full border-[3px] border-indigo-400/20 border-t-indigo-400"
          aria-hidden
        />
        <div
          className="absolute inset-2 animate-pulse rounded-full bg-indigo-500/10 ring-1 ring-indigo-400/25"
          aria-hidden
        />
      </div>

      <div className="w-full max-w-sm space-y-3 text-center">
        <p className="text-sm font-medium tracking-tight text-indigo-100">{label}</p>
        <ProposalGeneratingTopBar percent={percent} />
        <p className="text-xs text-zinc-500">AI is tailoring your proposal, questions, and bid</p>
      </div>
    </div>
  );
}

export function GeneratingProjectBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-violet-500/20 font-medium text-violet-100 ring-1 ring-violet-400/45 ${
        compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-[11px]"
      }`}
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-300 opacity-70" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-violet-300" />
      </span>
      Generating proposal…
    </span>
  );
}
