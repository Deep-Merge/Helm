"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight text-zinc-100">{value}</p>
    </div>
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
        description="Manage accounts and review each member's bidding activity."
        meta={loading ? undefined : `${users.length} user${users.length === 1 ? "" : "s"}`}
      />

      {error && (
        <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}
      {notice && (
        <p className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {notice}
        </p>
      )}

      <section className="glass mb-6 rounded-2xl p-5">
        <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-zinc-500">
          Add member
        </h2>
        <form onSubmit={handleCreate} className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <label className="flex-1 space-y-1.5">
            <span className="text-xs text-zinc-500">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm outline-none transition focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30"
            />
          </label>
          <label className="flex-1 space-y-1.5">
            <span className="text-xs text-zinc-500">Password</span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm outline-none transition focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30"
            />
          </label>
          <label className="w-full space-y-1.5 lg:w-36">
            <span className="text-xs text-zinc-500">Role</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "user" | "admin")}
              className="w-full rounded-xl border border-white/10 bg-[#0c0c0f] px-4 py-2.5 text-sm outline-none transition focus:border-indigo-500/60"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={creating}
            className="rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50 lg:shrink-0"
          >
            {creating ? "Adding…" : "Add user"}
          </button>
        </form>
      </section>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading team…</p>
      ) : users.length === 0 ? (
        <div className="glass flex flex-col items-center justify-center rounded-2xl py-16 text-center">
          <p className="text-lg font-medium text-zinc-300">No team members yet</p>
          <p className="mt-2 text-sm text-zinc-500">Add your first user above.</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(260px,320px)_1fr]">
          <section className="glass overflow-hidden rounded-2xl">
            <div className="border-b border-white/[0.06] px-4 py-3">
              <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500">Members</h2>
            </div>
            <ul className="max-h-[520px] divide-y divide-white/[0.04] overflow-y-auto">
              {users.map((user) => {
                const active = selected?.id === user.id;
                const stats = user.analytics.overview;
                return (
                  <li key={user.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(user.id)}
                      className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition ${
                        active
                          ? "bg-indigo-500/[0.08] ring-1 ring-inset ring-indigo-500/20"
                          : "hover:bg-white/[0.02]"
                      }`}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.04] text-sm font-semibold text-zinc-300 ring-1 ring-white/10">
                        {user.email[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-zinc-100">{user.email}</p>
                          <RoleBadge role={user.role} />
                        </div>
                        <p className="mt-1 text-xs text-zinc-500">
                          {stats.submitted} submitted · {stats.projects_viewed} viewed
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          {selected && overview && (
            <section className="glass rounded-2xl p-6">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.06] pb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold tracking-tight text-zinc-100">
                      {selected.email}
                    </h2>
                    <RoleBadge role={selected.role} />
                  </div>
                  <p className="mt-1 text-sm text-zinc-500">
                    {selected.created_at
                      ? `Joined ${new Date(selected.created_at).toLocaleDateString()}`
                      : "Member"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  disabled={deleting || selected.id === currentUserId}
                  title={selected.id === currentUserId ? "You cannot delete yourself" : undefined}
                  className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-2 text-sm text-red-300 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {deleting ? "Deleting…" : "Delete user"}
                </button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricPill label="Discovered" value={overview.projects_discovered} />
                <MetricPill label="Viewed" value={overview.projects_viewed} />
                <MetricPill label="Submitted" value={overview.submitted} />
                <MetricPill
                  label="Submit rate"
                  value={`${Math.round(overview.submission_rate * 100)}%`}
                />
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <div>
                  <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Funnel
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(selected.analytics.funnel).map(([status, count]) => (
                      <div key={status}>
                        <div className="mb-1 flex justify-between text-sm capitalize">
                          <span className="text-zinc-300">{status}</span>
                          <span className="text-zinc-500">{count}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/5">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                            style={{ width: `${(count / funnelMax) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                    {Object.keys(selected.analytics.funnel).length === 0 && (
                      <p className="text-sm text-zinc-500">No activity yet.</p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Top skills
                  </h3>
                  <div className="space-y-2">
                    {selected.analytics.top_skills.map((skill) => (
                      <div key={skill.skill} className="flex items-center gap-3 text-sm">
                        <span className="w-24 truncate text-zinc-400">{skill.skill}</span>
                        <div className="h-1.5 flex-1 rounded-full bg-white/5">
                          <div
                            className="h-full rounded-full bg-indigo-500/60"
                            style={{ width: `${(skill.count / skillMax) * 100}%` }}
                          />
                        </div>
                        <span className="w-6 text-right text-zinc-500">{skill.count}</span>
                      </div>
                    ))}
                    {selected.analytics.top_skills.length === 0 && (
                      <p className="text-sm text-zinc-500">No skills data yet.</p>
                    )}
                  </div>
                  <p className="mt-4 text-xs text-zinc-500">
                    {overview.proposals_generated} proposals · {Math.round(overview.win_rate * 100)}%
                    win rate
                  </p>
                </div>
              </div>

              <div className="mt-6 border-t border-white/[0.06] pt-5">
                <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Email
                </h3>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    type="email"
                    required
                    placeholder="Email address"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm outline-none transition focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSetEmail()}
                    disabled={
                      savingEmail ||
                      !newEmail.trim() ||
                      newEmail.trim().toLowerCase() === selected.email.toLowerCase()
                    }
                    className="rounded-xl bg-white/5 px-5 py-2.5 text-sm font-medium text-zinc-200 ring-1 ring-white/10 transition hover:bg-white/10 disabled:opacity-40"
                  >
                    {savingEmail ? "Saving…" : "Update email"}
                  </button>
                </div>
              </div>

              <div className="mt-6 border-t border-white/[0.06] pt-5">
                <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Password
                </h3>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    type="password"
                    minLength={6}
                    placeholder="New password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm outline-none transition focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSetPassword()}
                    disabled={savingPassword || newPassword.length < 6}
                    className="rounded-xl bg-white/5 px-5 py-2.5 text-sm font-medium text-zinc-200 ring-1 ring-white/10 transition hover:bg-white/10 disabled:opacity-40"
                  >
                    {savingPassword ? "Saving…" : "Update password"}
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}
