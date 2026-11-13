import { NextResponse } from "next/server";
import { authorizationHeader } from "@/lib/auth-token";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function POST(request: Request) {
  const incoming = new URL(request.url).searchParams;
  const res = await fetch(`${API_URL}/projects/delete-range?${incoming.toString()}`, {
    method: "POST",
    headers: await authorizationHeader(),
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
