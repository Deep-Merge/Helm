"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isLocalAuthEnabled, isSupabaseConfigured } from "@/lib/config";

export function useAuthUser() {
  const supabaseConfigured = isSupabaseConfigured();
  const localAuth = isLocalAuthEnabled();

  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(supabaseConfigured || localAuth);

  useEffect(() => {
    if (localAuth) {
      fetch("/api/auth/me", { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          setUserId(data?.user?.id ?? null);
          setEmail(data?.user?.email ?? null);
          setRole(data?.user?.role ?? null);
          setLoading(false);
        })
        .catch(() => setLoading(false));
      return;
    }

    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }

    const supabase = createClient();

    const syncUser = (id: string | null, userEmail: string | null) => {
      setUserId(id);
      setEmail(userEmail);
      setLoading(false);
    };

    supabase.auth.getUser().then(({ data }) => {
      syncUser(data.user?.id ?? null, data.user?.email ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      syncUser(session?.user?.id ?? null, session?.user?.email ?? null);
    });

    return () => subscription.unsubscribe();
  }, [localAuth, supabaseConfigured]);

  return {
    supabaseConfigured,
    localAuth,
    userId,
    email,
    role,
    loading,
    isDevMode: !supabaseConfigured && !localAuth,
    isAdmin: role === "admin",
  };
}
