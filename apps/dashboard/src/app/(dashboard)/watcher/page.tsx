"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout";
import type { WatcherConfig } from "@/lib/api";

export default function WatcherPage() {
  const [configs, setConfigs] = useState<WatcherConfig[]>([]);
  const [name, setName] = useState("");
  const [searchUrl, setSearchUrl] = useState("");

  useEffect(() => {
    fetch("/api/watcher").then((r) => r.json()).then((d) => setConfigs(d.configs || []));
  }, []);

  async function addConfig(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/watcher", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, search_url: searchUrl, poll_interval_sec: 60, is_active: true }),
    });
    setName("");
    setSearchUrl("");
    const res = await fetch("/api/watcher");
    const d = await res.json();
    setConfigs(d.configs || []);
  }

  async function toggle(id: string, is_active: boolean) {
    await fetch("/api/watcher", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_active: !is_active }),
    });
    setConfigs((c) => c.map((x) => (x.id === id ? { ...x, is_active: !is_active } : x)));
  }

  return (
    <>
      <PageHeader title="Watcher" description="Saved Freelancer searches to monitor for new projects." />

      <form onSubmit={addConfig} className="glass mb-6 grid gap-3 rounded-2xl p-6 md:grid-cols-3">
        <input value={name} onChange={(e) => setName(e.target.value)} required
          placeholder="Config name" className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm" />
        <input value={searchUrl} onChange={(e) => setSearchUrl(e.target.value)} required
          placeholder="Freelancer search URL" className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm md:col-span-2" />
        <button type="submit" className="rounded-xl bg-indigo-500 py-2 text-sm font-medium text-white md:col-span-3">
          Add watcher
        </button>
      </form>

      <div className="space-y-3">
        {configs.map((c) => (
          <div key={c.id} className="glass flex items-center justify-between rounded-2xl p-4">
            <div>
              <p className="font-medium text-zinc-200">{c.name}</p>
              <p className="truncate text-xs text-zinc-500">{c.search_url}</p>
            </div>
            <button type="button" onClick={() => toggle(c.id, c.is_active)}
              className={`rounded-lg px-3 py-1 text-xs ${c.is_active ? "bg-emerald-500/20 text-emerald-300" : "bg-zinc-700/30 text-zinc-500"}`}>
              {c.is_active ? "Active" : "Paused"}
            </button>
          </div>
        ))}
        {configs.length === 0 && <p className="text-sm text-zinc-500">No watcher configs yet.</p>}
      </div>
    </>
  );
}
