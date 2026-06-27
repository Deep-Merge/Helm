export function LoginForm({ error }: { error?: string }) {
  return (
    <form
      action="/auth/login"
      method="post"
      className="glass w-full max-w-md rounded-2xl p-8"
    >
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 font-bold text-white">
          B
        </div>
        <div>
          <h1 className="text-lg font-semibold">Welcome back</h1>
          <p className="text-xs text-zinc-500">Sign in to your account</p>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500">
        Email
      </label>
      <input
        name="email"
        type="email"
        required
        autoComplete="email"
        className="mb-4 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-zinc-200 outline-none focus:border-indigo-500"
        placeholder="you@example.com"
      />

      <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500">
        Password
      </label>
      <input
        name="password"
        type="password"
        required
        minLength={6}
        autoComplete="current-password"
        className="mb-6 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-zinc-200 outline-none focus:border-indigo-500"
        placeholder="••••••••"
      />

      <button
        type="submit"
        className="w-full rounded-xl bg-indigo-500 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400"
      >
        Sign in
      </button>

      <p className="mt-4 text-center text-xs text-zinc-500">
        No account?{" "}
        <a href="/signup" className="text-indigo-400 hover:underline">
          Create one
        </a>
      </p>
    </form>
  );
}
