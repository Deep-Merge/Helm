import { getAccessToken } from "@/lib/supabase/server";
import { getLocalSessionToken } from "@/lib/local-auth/server";
import { isLocalAuthEnabled, isSupabaseConfigured } from "@/lib/config";

export async function getBearerToken(): Promise<string | null> {
  if (isSupabaseConfigured()) {
    return getAccessToken();
  }
  if (isLocalAuthEnabled()) {
    return getLocalSessionToken();
  }
  return null;
}

export async function authorizationHeader(): Promise<Record<string, string>> {
  const token = await getBearerToken();
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  if (!isSupabaseConfigured() && !isLocalAuthEnabled()) {
    return { Authorization: "Bearer dev-token" };
  }
  return {};
}
