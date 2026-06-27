"use client";

import { useRouter } from "next/navigation";
import { FilterInput, FilterSelect } from "@/components/filter-field";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  ...["new", "viewed", "drafted", "submitted", "ignored", "won", "lost"].map((s) => ({
    value: s,
    label: s.charAt(0).toUpperCase() + s.slice(1),
  })),
];

export function ProjectSearch({
  defaultQ,
  defaultStatus,
}: {
  defaultQ?: string;
  defaultStatus?: string;
}) {
  const router = useRouter();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const q = fd.get("q") as string;
    const status = fd.get("status") as string;
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    router.push(`/projects?${params.toString()}`);
  }

  return (
    <form onSubmit={onSubmit} className="glass mb-6 flex flex-wrap gap-3 rounded-2xl p-4">
      <FilterInput
        name="q"
        defaultValue={defaultQ}
        placeholder="Search projects…"
        className="min-w-[200px] flex-1"
      />
      <FilterSelect
        name="status"
        defaultValue={defaultStatus || ""}
        options={STATUS_OPTIONS}
        className="w-44"
        aria-label="Status"
      />
      <button type="submit" className="rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-medium text-white">
        Filter
      </button>
    </form>
  );
}
