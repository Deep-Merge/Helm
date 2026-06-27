"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout";
import { AccountSection } from "@/components/account-section";
import type { Profile } from "@/lib/api";
import Link from "next/link";

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [skillsText, setSkillsText] = useState("");

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        if (d.profile) {
          setProfile(d.profile);
          setSkillsText((d.profile.skills || []).join(", "));
        }
      })
      .catch(() => {
        setProfile({
          id: "",
          display_name: "Dev User",
          title: "Senior Full-Stack Developer",
          bio: "",
          skills: ["React", "Next.js", "Node.js"],
          proposal_style: "Warm, confident, human.",
          default_direction: "Ask to discuss in Freelancer chat.",
          default_model_tier: "auto",
        });
      });
  }, []);

  async function save() {
    if (!profile) return;
    setSaving(true);
    setSaved(false);
    const skills = skillsText.split(",").map((s) => s.trim()).filter(Boolean);
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...profile, skills }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!profile) {
    return (
      <div className="text-sm text-zinc-500">Loading profile…</div>
    );
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="Profile, AI preferences, and extension connection."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <AccountSection />

        <section className="glass rounded-2xl p-6">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-zinc-500">
            Profile
          </h2>
          <div className="space-y-4 text-sm">
            <div>
              <label className="mb-1 block text-zinc-500">Display name</label>
              <input
                value={profile.display_name || ""}
                onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
                className="w-full rounded-xl border border-[var(--border)] bg-white/[0.03] px-4 py-2.5 text-zinc-300 outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-zinc-500">Title</label>
              <input
                value={profile.title || ""}
                onChange={(e) => setProfile({ ...profile, title: e.target.value })}
                className="w-full rounded-xl border border-[var(--border)] bg-white/[0.03] px-4 py-2.5 text-zinc-300 outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-zinc-500">Skills (comma-separated)</label>
              <input
                value={skillsText}
                onChange={(e) => setSkillsText(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-white/[0.03] px-4 py-2.5 text-zinc-300 outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-zinc-500">Tone & style</label>
              <textarea
                rows={2}
                value={profile.proposal_style || ""}
                onChange={(e) => setProfile({ ...profile, proposal_style: e.target.value })}
                className="w-full rounded-xl border border-[var(--border)] bg-white/[0.03] px-4 py-2.5 text-zinc-300 outline-none focus:border-indigo-500"
                placeholder="Warm, confident, human tone…"
              />
            </div>
            <div>
              <label className="mb-1 block text-zinc-500">Bid rules</label>
              <p className="mb-2 text-xs text-zinc-600">
                Used by the Chrome extension — controls proposal, questions, budget, and timeline.
              </p>
              <textarea
                rows={5}
                value={profile.default_direction || ""}
                onChange={(e) => setProfile({ ...profile, default_direction: e.target.value })}
                className="w-full rounded-xl border border-[var(--border)] bg-white/[0.03] px-4 py-2.5 text-zinc-300 outline-none focus:border-indigo-500"
                placeholder="How to write proposals, suggest budget, timeline, and client questions…"
              />
            </div>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-xl bg-indigo-500 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
            >
              {saving ? "Saving…" : saved ? "Saved ✓" : "Save profile"}
            </button>
          </div>
        </section>

        <section className="glass rounded-2xl p-6 lg:col-span-2">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-zinc-500">
            Extension
          </h2>
          {process.env.NEXT_PUBLIC_SUPABASE_URL ? (
            <>
              <p className="mb-4 text-sm text-zinc-400">
                Connect your Chrome extension to sync bids with this account.
              </p>
              <Link
                href="/connect-extension"
                className="inline-block rounded-xl bg-white/5 px-5 py-2.5 text-sm font-medium text-indigo-300 ring-1 ring-white/10 hover:bg-white/10"
              >
                Connect extension →
              </Link>
            </>
          ) : (
            <>
              <p className="mb-4 text-sm text-zinc-400">
                After signing in, connect the extension so bids sync to your account on this server.
              </p>
              <Link
                href="/connect-extension"
                className="inline-block rounded-xl bg-white/5 px-5 py-2.5 text-sm font-medium text-indigo-300 ring-1 ring-white/10 hover:bg-white/10"
              >
                Connect extension →
              </Link>
            </>
          )}

        </section>
      </div>
    </>
  );
}
