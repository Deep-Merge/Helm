import { createClient } from "@/lib/supabase/server";
import { getLocalSessionToken } from "@/lib/local-auth/server";
import { isLocalAuthEnabled, isSupabaseConfigured } from "@/lib/config";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect("/");
  } else if (isLocalAuthEnabled() && (await getLocalSessionToken())) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#09090b] px-4">
      <LoginForm error={error} />
    </div>
  );
}
