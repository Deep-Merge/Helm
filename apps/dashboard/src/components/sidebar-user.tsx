"use client";

import Link from "next/link";
import { useAuthUser } from "@/lib/use-auth-user";

export function SidebarUser() {
  const { email, loading, isDevMode, localAuth, role } = useAuthUser();

  if (loading) {
    return (
      <div className="mx-3 mb-2 rounded-xl bg-white/[0.03] px-3 py-2.5">
        <div className="h-3 w-24 animate-pulse rounded bg-white/[0.06]" />
      </div>
    );
  }

  if (isDevMode) {
    return (
      <div className="mx-3 mb-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
        <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
          Local server
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
          No login configured. Data saves on this PC.
        </p>
      </div>
    );
  }

  const display = email || "Signed in";

  return (
    <div className="mx-3 mb-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
        {localAuth ? "Signed in" : "Your account"}
      </p>
      <p className="mt-0.5 truncate text-sm font-medium text-zinc-200" title={display}>
        {display}
        {role === "admin" && (
          <span className="ml-1.5 rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-medium uppercase text-indigo-300">
            Admin
          </span>
        )}
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-zinc-600">
        {localAuth
          ? "Your projects and statuses are saved under this account."
          : "Projects and statuses sync through Supabase."}
      </p>
      {localAuth && (
        <form action="/auth/logout" method="post" className="mt-2">
          <button
            type="submit"
            className="text-[11px] text-zinc-500 hover:text-zinc-300"
          >
            Sign out
          </button>
        </form>
      )}
    </div>
  );
}
