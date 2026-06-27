function SkeletonCard() {
  return (
    <div className="glass animate-pulse rounded-2xl px-6 py-5">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="h-6 w-4/5 rounded-lg bg-white/10" />
          <div className="h-4 w-1/3 rounded-lg bg-white/[0.06]" />
        </div>
        <div className="w-[148px] shrink-0 space-y-2">
          <div className="ml-auto h-4 w-16 rounded bg-white/[0.06]" />
          <div className="ml-auto h-7 w-24 rounded-lg bg-white/10" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-4 w-full rounded bg-white/[0.06]" />
        <div className="h-4 w-11/12 rounded bg-white/[0.06]" />
        <div className="h-4 w-2/3 rounded bg-white/[0.06]" />
      </div>
      <div className="mt-4 flex gap-2">
        <div className="h-5 w-20 rounded bg-white/[0.06]" />
        <div className="h-5 w-16 rounded bg-white/[0.06]" />
        <div className="h-5 w-24 rounded bg-white/[0.06]" />
      </div>
      <div className="mt-4 flex justify-between border-t border-white/[0.06] pt-3.5">
        <div className="flex gap-3">
          <div className="h-5 w-24 rounded bg-white/[0.06]" />
          <div className="h-5 w-16 rounded bg-white/[0.06]" />
        </div>
        <div className="h-5 w-20 rounded bg-white/[0.06]" />
      </div>
    </div>
  );
}

export function ProjectListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function DiscoverLoadingIndicator({
  message = "Searching Freelancer…",
}: {
  message?: string;
}) {
  return (
    <div
      className="mb-4 flex items-center gap-3 rounded-xl border border-indigo-500/20 bg-indigo-500/[0.06] px-4 py-3"
      role="status"
      aria-live="polite"
    >
      <span className="relative flex h-5 w-5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400/30" />
        <span className="relative inline-flex h-5 w-5 animate-spin rounded-full border-2 border-indigo-400/30 border-t-indigo-400" />
      </span>
      <p className="text-base text-indigo-200/90">{message}</p>
    </div>
  );
}
