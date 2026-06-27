import { NextResponse } from "next/server";
import { authorizationHeader } from "@/lib/auth-token";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

async function authHeaders() {
  return {
    "Content-Type": "application/json",
    ...(await authorizationHeader()),
  };
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const qs = url.searchParams.toString();
  const res = await fetch(`${API_URL}/projects/discover${qs ? `?${qs}` : ""}`, {
    method: "POST",
    headers: await authHeaders(),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }
  return NextResponse.json(data);
}
