import { NextResponse } from "next/server";
import { authorizationHeader } from "@/lib/auth-token";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function authHeaders() {
  return {
    "Content-Type": "application/json",
    ...(await authorizationHeader()),
  };
}

export async function GET() {
  const res = await fetch(`${API_URL}/watcher/configs`, { headers: await authHeaders(), cache: "no-store" });
  return NextResponse.json(await res.json(), { status: res.status });
}

export async function POST(request: Request) {
  const body = await request.json();
  const res = await fetch(`${API_URL}/watcher/configs`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  return NextResponse.json(await res.json(), { status: res.status });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const res = await fetch(`${API_URL}/watcher/configs/${body.id}`, {
    method: "PATCH",
    headers: await authHeaders(),
    body: JSON.stringify({ is_active: body.is_active }),
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
