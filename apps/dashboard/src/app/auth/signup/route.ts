import { isSupabaseConfigured } from "@/lib/config";
import { setLocalSessionCookie } from "@/lib/local-auth/server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") || "");
  const password = String(form.get("password") || "");

  if (!isSupabaseConfigured()) {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const message = data.detail || "Could not create account";
      redirect(`/signup?error=${encodeURIComponent(message)}`);
    }
    const data = await res.json();
    await setLocalSessionCookie(data.access_token);
    redirect("/");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/");
}
