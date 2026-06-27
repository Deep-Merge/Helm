export function StatCard({
  label,
  value,
  hint,
  accent = "indigo",
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: "indigo" | "emerald" | "amber" | "violet" | "sky" | "zinc";
}) {
  const accents = {
    indigo: "from-indigo-500/20 to-indigo-500/5 text-indigo-300",
    emerald: "from-emerald-500/20 to-emerald-500/5 text-emerald-300",
    amber: "from-amber-500/20 to-amber-500/5 text-amber-300",
    violet: "from-violet-500/20 to-violet-500/5 text-violet-300",
    sky: "from-sky-500/20 to-sky-500/5 text-sky-300",
    zinc: "from-zinc-500/15 to-zinc-500/5 text-zinc-300",
  };

  return (
    <div className="glass group relative overflow-hidden rounded-2xl p-5 transition hover:border-white/12">
      <div className={`absolute inset-0 bg-gradient-to-br ${accents[accent]} opacity-60`} />
      <div className="relative">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
        {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
      </div>
    </div>
  );
}
