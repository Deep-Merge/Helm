import { type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/config";
import { updateLocalSession } from "@/lib/local-auth/middleware";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  if (isSupabaseConfigured()) {
    return updateSession(request);
  }
  return updateLocalSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
