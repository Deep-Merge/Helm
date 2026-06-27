import { redirect } from "next/navigation";
import { getBearerToken } from "@/lib/auth-token";
import { isLocalAuthEnabled } from "@/lib/config";
import { AdminPageClient } from "./admin-page-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default async function AdminPage() {
  if (!isLocalAuthEnabled()) {
    redirect("/");
  }

  const token = await getBearerToken();
  if (!token) redirect("/login");

  const res = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) redirect("/login");
  const data = await res.json();
  if (data.user?.role !== "admin") redirect("/");

  return <AdminPageClient />;
}
