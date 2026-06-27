import { isSupabaseConfigured } from "@/lib/config";
import { clearLocalSessionCookie } from "@/lib/local-auth/server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function POST() {
  if (!isSupabaseConfigured()) {
    await clearLocalSessionCookie();
    redirect("/login");
  }

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
