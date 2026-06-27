import { NextResponse } from "next/server";
import { authorizationHeader } from "@/lib/auth-token";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

async function authHeaders() {
  return {
    "Content-Type": "application/json",
    ...(await authorizationHeader()),
  };
}

export async function GET() {
  const res = await fetch(`${API_URL}/filters`, { headers: await authHeaders(), cache: "no-store" });
  return NextResponse.json(await res.json(), { status: res.status });
}

export async function POST(request: Request) {
  const body = await request.json();
  const res = await fetch(`${API_URL}/filters`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  return NextResponse.json(await res.json(), { status: res.status });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const res = await fetch(`${API_URL}/filters/${id}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
