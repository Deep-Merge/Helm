"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FilterSelect, fieldBase } from "@/components/filter-field";
import { PageHeader } from "@/components/layout";
import { useAuthUser } from "@/lib/use-auth-user";

type UserSummary = {
  id: string;
  email: string;
  role: string;
  created_at?: string;
  analytics: {
    overview: {
      projects_discovered: number;
      projects_viewed: number;
      proposals_generated: number;
      submitted: number;
      submission_rate: number;
      win_rate: number;
    };
    funnel: Record<string, number>;
    top_skills: { skill: string; count: number }[];
  };
};

const ROLE_OPTIONS = [
  { value: "user", label: "User" },
  { value: "admin", label: "Admin" },
] as const;

const inputClass = `${fieldBase} h-10 rounded-xl px-3.5 text-sm`;

function RoleBadge({ role }: { role: string }) {
  const isAdmin = role === "admin";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
        isAdmin
          ? "bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-500/25"
          : "bg-white/5 text-zinc-400 ring-1 ring-white/10"
      }`}
    >
      {role}
    </span>
  );
}

function MetricPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tracking-tight text-zinc-100">{value}</p>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
      {children}
    </h2>
  );
}

export function AdminPageClient() {
  const { userId: currentUserId } = useAuthUser();
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const selected = useMemo(
    () => users.find((user) => user.id === selectedId) ?? users[0] ?? null,
    [users, selectedId],
  );

  const memberOptions = useMemo(
    () =>
      users.map((user) => ({
        value: user.id,
        label: user.email,
      })),
    [users],
  );

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Error ${res.status}`);
      }
      const data = await res.json();
      const nextUsers: UserSummary[] = data.users || [];
      setUsers(nextUsers);
      setSelectedId((prev) => {
        if (prev && nextUsers.some((user) => user.id === prev)) return prev;
        return nextUsers[0]?.id ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    setNewEmail(selected?.email ?? "");
    setNewPassword("");
  }, [selected?.id, selected?.email]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Could not create user");
      setEmail("");
      setPassword("");
      setRole("user");
      setNotice(`Created ${data.user?.email || "user"}`);
      await loadUsers();
      if (data.user?.id) setSelectedId(data.user.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create user");
    } finally {
      setCreating(false);
    }
  }

  async function handleSetEmail() {
    if (!selected) return;
    const trimmed = newEmail.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Enter a valid email address");
      return;
    }
    if (trimmed.toLowerCase() === selected.email.toLowerCase()) {
      setError("Email is unchanged");
      return;
    }
    setSavingEmail(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/users/${selected.id}/email`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Could not update email");
      setNotice(`Email updated to ${data.user?.email || trimmed}`);
      await loadUsers();
      if (data.user?.id) setSelectedId(data.user.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update email");
    } finally {
      setSavingEmail(false);
    }
  }

  async function handleSetPassword() {
    if (!selected) return;
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setSavingPassword(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/users/${selected.id}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Could not update password");
      setNewPassword("");
      setNotice(`Password updated for ${selected.email}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update password");
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleDelete() {
    if (!selected) return;
    if (selected.id === currentUserId) {
      setError("You cannot delete your own account");
      return;
    }
    const confirmed = window.confirm(
      `Delete ${selected.email}? This removes their projects, bids, and analytics.`,
    );
    if (!confirmed) return;

    setDeleting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/users/${selected.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Could not delete user");
      setNotice(`Deleted ${selected.email}`);
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete user");
    } finally {
      setDeleting(false);
    }
  }

  const funnelMax = Math.max(...Object.values(selected?.analytics.funnel ?? {}), 1);
  const skillMax = selected?.analytics.top_skills[0]?.count || 1;
  const overview = selected?.analytics.overview;

  return (
    <>
      <PageHeader
        title="Team"
        description="Manage accounts and review member performance."
        meta={loading ? undefined : `${users.length} member${users.length === 1 ? "" : "s"}`}
      />

      {error && (
        <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          {error}
        </p>
      )}
      {notice && (
        <p className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
          {notice}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading team…</p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(220px,260px)_1fr] lg:items-start">
          <section className="glass rounded-2xl p-4">
            <SectionLabel>Add member</SectionLabel>
            <form onSubmit={handleCreate} className="mt-3 flex flex-col gap-3">
              <label className="block space-y-1.5">
                <span className="text-xs text-zinc-500">Email</span>
                <input
                  type="email"
                  required
                  autoComplete="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className={inputClass}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs text-zinc-500">Password</span>
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className={inputClass}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs text-zinc-500">Role</span>
                <FilterSelect
                  value={role}
                  onChange={(v) => setRole(v as "user" | "admin")}
                  options={ROLE_OPTIONS}
                  size="comfortable"
                  aria-label="Role"
                />
              </label>
              <button
                type="submit"
                disabled={creating}
                className="mt-1 w-full rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {creating ? "Adding…" : "Add user"}
              </button>
            </form>
          </section>

          {users.length === 0 ? (
            <div className="glass flex min-h-[280px] flex-col items-center justify-center rounded-2xl px-6 py-12 text-center">
              <p className="text-base font-medium text-zinc-300">No team members yet</p>
              <p className="mt-1.5 text-sm text-zinc-500">Add your first user on the left.</p>
            </div>
          ) : (
            selected &&
            overview && (
              <section className="glass rounded-2xl p-4 sm:p-5">
                <div className="flex flex-col gap-3 border-b border-white/[0.06] pb-4 sm:flex-row sm:items-end sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <SectionLabel>Member</SectionLabel>
                    <FilterSelect
                      value={selected.id}
                      onChange={setSelectedId}
                      options={memberOptions}
                      size="comfortable"
                      aria-label="Select member"
                    />
                  </div>
                  <div className="flex shrink-0 items-center gap-2 sm:pb-0.5">
                    <RoleBadge role={selected.role} />
                    <button
                      type="button"
                      onClick={() => void handleDelete()}
                      disabled={deleting || selected.id === currentUserId}
                      title={selected.id === currentUserId ? "You cannot delete yourself" : undefined}
                      className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {deleting ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>

                <p className="mt-3 text-xs text-zinc-500">
                  {selected.created_at
                    ? `Joined ${new Date(selected.created_at).toLocaleDateString()}`
                    : "Member"}{" "}
                  · {selected.analytics.overview.projects_viewed} viewed ·{" "}
                  {selected.analytics.overview.submitted} submitted
                </p>

                <div className="mt-4 grid grid-cols-2 gap-2 xl:grid-cols-4">
                  <MetricPill label="Discovered" value={overview.projects_discovered} />
                  <MetricPill label="Viewed" value={overview.projects_viewed} />
                  <MetricPill label="Submitted" value={overview.submitted} />
                  <MetricPill
                    label="Submit rate"
                    value={`${Math.round(overview.submission_rate * 100)}%`}
                  />
                </div>

                <div className="mt-5 grid gap-5 md:grid-cols-2">
                  <div>
                    <SectionLabel>Funnel</SectionLabel>
                    <div className="mt-2.5 space-y-2.5">
                      {Object.entries(selected.analytics.funnel).map(([status, count]) => (
                        <div key={status}>
                          <div className="mb-1 flex justify-between text-xs capitalize">
                            <span className="text-zinc-300">{status}</span>
                            <span className="text-zinc-500">{count}</span>
                          </div>
                          <div className="h-1 rounded-full bg-white/5">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                              style={{ width: `${(count / funnelMax) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                      {Object.keys(selected.analytics.funnel).length === 0 && (
                        <p className="text-xs text-zinc-500">No activity yet.</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <SectionLabel>Top skills</SectionLabel>
                    <div className="mt-2.5 space-y-2">
                      {selected.analytics.top_skills.map((skill) => (
                        <div key={skill.skill} className="flex items-center gap-2 text-xs">
                          <span className="w-20 truncate text-zinc-400">{skill.skill}</span>
                          <div className="h-1 flex-1 rounded-full bg-white/5">
                            <div
                              className="h-full rounded-full bg-indigo-500/60"
                              style={{ width: `${(skill.count / skillMax) * 100}%` }}
                            />
                          </div>
                          <span className="w-5 text-right text-zinc-500">{skill.count}</span>
                        </div>
                      ))}
                      {selected.analytics.top_skills.length === 0 && (
                        <p className="text-xs text-zinc-500">No skills data yet.</p>
                      )}
                    </div>
                    <p className="mt-3 text-[11px] text-zinc-500">
                      {overview.proposals_generated} proposals ·{" "}
                      {Math.round(overview.win_rate * 100)}% win rate
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 border-t border-white/[0.06] pt-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <SectionLabel>Email</SectionLabel>
                    <input
                      type="email"
                      required
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={() => void handleSetEmail()}
                      disabled={
                        savingEmail ||
                        !newEmail.trim() ||
                        newEmail.trim().toLowerCase() === selected.email.toLowerCase()
                      }
                      className="w-full rounded-xl bg-white/5 px-4 py-2 text-sm font-medium text-zinc-200 ring-1 ring-white/10 transition hover:bg-white/10 disabled:opacity-40"
                    >
                      {savingEmail ? "Saving…" : "Update email"}
                    </button>
                  </div>

                  <div className="space-y-2">
                    <SectionLabel>Password</SectionLabel>
                    <input
                      type="password"
                      minLength={6}
                      placeholder="New password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={() => void handleSetPassword()}
                      disabled={savingPassword || newPassword.length < 6}
                      className="w-full rounded-xl bg-white/5 px-4 py-2 text-sm font-medium text-zinc-200 ring-1 ring-white/10 transition hover:bg-white/10 disabled:opacity-40"
                    >
                      {savingPassword ? "Saving…" : "Update password"}
                    </button>
                  </div>
                </div>
              </section>
            )
          )}
        </div>
      )}
    </>
  );
}
