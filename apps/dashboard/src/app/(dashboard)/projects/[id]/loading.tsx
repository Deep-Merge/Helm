export default function ProjectDetailLoading() {
  return (
    <div
      className="-mb-[calc(2rem-10px)] flex h-[calc(100dvh-2rem-10px)] flex-col gap-3 overflow-hidden"
      aria-busy
      aria-label="Loading project"
    >
      <div className="shrink-0 animate-pulse space-y-3">
        <div className="h-4 w-28 rounded bg-white/[0.06]" />
        <div className="h-8 max-w-2xl rounded-lg bg-white/10" />
        <div className="h-4 max-w-md rounded bg-white/[0.06]" />
        <div className="flex gap-2">
          <div className="h-6 w-24 rounded-full bg-white/[0.06]" />
          <div className="h-6 w-20 rounded-full bg-white/[0.06]" />
        </div>
      </div>
      <div className="min-h-0 flex-1 animate-pulse rounded-2xl bg-white/[0.03] ring-1 ring-white/[0.06]" />
    </div>
  );
}
