import { getLocalSessionToken } from "@/lib/local-auth/server";
import { isLocalAuthEnabled, isSupabaseConfigured } from "@/lib/config";
import { redirect } from "next/navigation";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  if (isSupabaseConfigured()) {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect("/");

    return (
      <div className="flex min-h-screen items-center justify-center bg-[#09090b] px-4">
        <form action="/auth/signup" method="post" className="glass w-full max-w-md rounded-2xl p-8">
          <h1 className="mb-6 text-lg font-semibold">Create account</h1>
          {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
          <input name="email" type="email" required className="mb-4 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm" />
          <input name="password" type="password" required minLength={6} className="mb-6 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm" />
          <button type="submit" className="w-full rounded-xl bg-indigo-500 py-2.5 text-sm font-semibold text-white">Sign up</button>
        </form>
      </div>
    );
  }

  if (isLocalAuthEnabled() && (await getLocalSessionToken())) {
    redirect("/");
  }

  const openRes = await fetch(`${API_URL}/auth/register-open`, { cache: "no-store" });
  const openData = openRes.ok ? await openRes.json() : { open: false };

  if (!openData.open) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#09090b] px-4">
        <div className="glass w-full max-w-md rounded-2xl p-8 text-center">
          <h1 className="text-lg font-semibold">Sign up closed</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Ask your admin to create an account for you.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block rounded-xl bg-indigo-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-400"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#09090b] px-4">
      <form action="/auth/signup" method="post" className="glass w-full max-w-md rounded-2xl p-8">
        <div className="mb-6">
          <h1 className="text-lg font-semibold">Create admin account</h1>
          <p className="mt-1 text-xs text-zinc-500">First signup becomes the server admin.</p>
        </div>
        {error && (
          <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}
        <input name="email" type="email" required placeholder="Email" className="mb-4 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm" />
        <input name="password" type="password" required minLength={6} placeholder="Password" className="mb-6 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm" />
        <button type="submit" className="w-full rounded-xl bg-indigo-500 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400">
          Create admin
        </button>
        <p className="mt-4 text-center text-xs text-zinc-500">
          Already have an account? <a href="/login" className="text-indigo-400 hover:underline">Sign in</a>
        </p>
      </form>
    </div>
  );
}
