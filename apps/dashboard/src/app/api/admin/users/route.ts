import { NextResponse } from "next/server";
import { authorizationHeader } from "@/lib/auth-token";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function GET() {
  const res = await fetch(`${API_URL}/admin/users`, {
    headers: await authorizationHeader(),
    cache: "no-store",
  });
  return NextResponse.json(await res.json(), { status: res.status });
}

export async function POST(request: Request) {
  const body = await request.json();
  const res = await fetch(`${API_URL}/admin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await authorizationHeader()),
    },
    body: JSON.stringify(body),
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
