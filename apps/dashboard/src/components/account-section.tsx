"use client";

import { useEffect, useState } from "react";
import { isLocalAuthEnabled, isSupabaseConfigured } from "@/lib/config";

export function AccountSection() {
  const supabaseConfigured = isSupabaseConfigured();
  const localAuth = isLocalAuthEnabled();

  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(supabaseConfigured || localAuth);

  useEffect(() => {
    if (localAuth) {
      fetch("/api/auth/me", { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          setEmail(data?.user?.email ?? null);
          setLoading(false);
        })
        .catch(() => setLoading(false));
      return;
    }

    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }

    import("@/lib/supabase/client").then(({ createClient }) => {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data }) => {
        setEmail(data.user?.email ?? null);
        setLoading(false);
      });
    });
  }, [localAuth, supabaseConfigured]);

  if (!supabaseConfigured && !localAuth) {
    return (
      <section className="glass rounded-2xl p-6">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-zinc-500">
          Account
        </h2>
        <p className="text-sm leading-relaxed text-zinc-400">
          Local server mode without login. Data is stored in{" "}
          <code className="text-zinc-300">apps/api/data/store.json</code> on this machine.
        </p>
      </section>
    );
  }

  return (
    <section className="glass rounded-2xl p-6">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-zinc-500">
        Account
      </h2>
      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : (
        <div className="space-y-4 text-sm">
          <div>
            <p className="text-zinc-500">Signed in as</p>
            <p className="mt-1 font-medium text-zinc-200">{email || "Unknown user"}</p>
          </div>
          <p className="text-zinc-500 leading-relaxed">
            {localAuth
              ? "Each account has its own projects and statuses on this server. Teammates sign in with their own email and password."
              : "Sign in with the same account on every computer. Projects, bids, and statuses sync through Supabase."}{" "}
            Connect the extension via{" "}
            <a href="/connect-extension" className="text-indigo-400 hover:underline">
              Connect extension
            </a>
            .
          </p>
          <form action="/auth/logout" method="post">
            <button
              type="submit"
              className="rounded-xl bg-white/5 px-4 py-2 text-zinc-300 ring-1 ring-white/10 hover:bg-white/10"
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
