"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isLocalAuthEnabled } from "@/lib/config";

const extensionIdConfigured = Boolean(process.env.NEXT_PUBLIC_EXTENSION_ID);

export default function ConnectExtensionClient() {
  const [status, setStatus] = useState<"idle" | "connecting" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function connect() {
    setStatus("connecting");

    let token: string | null = null;
    let apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

    if (isLocalAuthEnabled()) {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      if (!res.ok) {
        setStatus("error");
        setMessage("Not signed in. Log in as the user you want the extension to use, then try again.");
        return;
      }
      const data = await res.json();
      token = data.access_token;
      apiUrl = data.api_url || apiUrl;
    } else {
      const supabase = createClient();
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        setStatus("error");
        setMessage("Not signed in. Log in as the user you want the extension to use, then try again.");
        return;
      }
      token = data.session.access_token;
    }

    const extensionId = process.env.NEXT_PUBLIC_EXTENSION_ID;

    try {
      if (extensionId && typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
        await chrome.runtime.sendMessage(extensionId, {
          type: "AUTH_TOKEN",
          token,
          apiUrl,
        });
        setStatus("done");
        setMessage("Extension connected to your account. Open a Freelancer project to generate a bid.");
      } else {
        await navigator.clipboard.writeText(token!);
        setStatus("done");
        setMessage(
          extensionIdConfigured
            ? "Open this page in Chrome (where the extension is installed). Token copied — paste it in the extension popup → Auth token → Save."
            : "Token copied. Paste it in the extension popup → Auth token → Save. For one-click connect, add NEXT_PUBLIC_EXTENSION_ID to apps/dashboard/.env.local (see steps below).",
        );
      }
    } catch {
      await navigator.clipboard.writeText(token!);
      setStatus("done");
      setMessage(
        "Could not reach the extension automatically. Token copied — paste it in the extension popup → Auth token → Save.",
      );
    }
  }

  return (
    <div className="glass mx-auto max-w-lg rounded-2xl p-8">
      <h1 className="text-xl font-semibold">Connect Chrome Extension</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Links this Chrome browser to whoever is logged in on the dashboard. Each teammate signs in with
        their own account and connects once on their machine.
      </p>

      <ol className="mt-6 space-y-2 text-sm text-zinc-400">
        <li>1. Log in on the dashboard as the user you want (not someone else&apos;s account)</li>
        <li>2. Load the extension in Chrome from <code className="text-zinc-300">apps/extension/dist</code></li>
        <li>3. Open this page in the same Chrome browser and click Connect below</li>
        <li>4. Open a Freelancer project — the panel should generate using your profile</li>
      </ol>

      {!extensionIdConfigured && (
        <div className="mt-5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
          <p className="font-medium text-amber-200">Optional: enable one-click connect</p>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-amber-100/80">
            <li>Chrome → <code className="text-amber-100">chrome://extensions</code> → copy BidAutomation ID</li>
            <li>
              Add to <code className="text-amber-100">apps/dashboard/.env.local</code>:{" "}
              <code className="text-amber-100">NEXT_PUBLIC_EXTENSION_ID=your_id</code>
            </li>
            <li>Restart the dashboard (<code className="text-amber-100">npm run dev</code>)</li>
          </ol>
        </div>
      )}

      <button
        type="button"
        onClick={connect}
        disabled={status === "connecting"}
        className="mt-6 w-full rounded-xl bg-indigo-500 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-50"
      >
        {status === "connecting" ? "Connecting…" : "Connect extension"}
      </button>

      {message && (
        <p
          className={`mt-4 text-sm ${
            status === "error" ? "text-red-400" : "text-emerald-400"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
