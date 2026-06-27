"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout";
import type { Template } from "@/lib/api";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    fetch("/api/templates").then((r) => r.json()).then((d) => setTemplates(d.templates || []));
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, content, is_winning_example: true }),
    });
    setName("");
    setContent("");
    const res = await fetch("/api/templates");
    setTemplates((await res.json()).templates || []);
  }

  return (
    <>
      <PageHeader title="Templates" description="Winning proposals used as AI examples." />

      <form onSubmit={add} className="glass mb-6 space-y-3 rounded-2xl p-6">
        <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Template name"
          className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm" />
        <textarea value={content} onChange={(e) => setContent(e.target.value)} required rows={6}
          placeholder="Paste a winning proposal…"
          className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm" />
        <button type="submit" className="rounded-xl bg-indigo-500 px-5 py-2 text-sm font-medium text-white">
          Save template
        </button>
      </form>

      <div className="space-y-4">
        {templates.map((t) => (
          <article key={t.id} className="glass rounded-2xl p-6">
            <div className="mb-2 flex items-center gap-2">
              <h2 className="font-medium text-zinc-200">{t.name}</h2>
              {t.is_winning_example && (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">Winning</span>
              )}
            </div>
            <p className="whitespace-pre-wrap text-sm text-zinc-400 line-clamp-6">{t.content}</p>
          </article>
        ))}
        {templates.length === 0 && <p className="text-sm text-zinc-500">No templates yet.</p>}
      </div>
    </>
  );
}
