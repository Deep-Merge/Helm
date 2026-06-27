import { NextResponse } from "next/server";
import { authorizationHeader } from "@/lib/auth-token";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function GET() {
  const res = await fetch(`${API_URL}/projects/skills`, {
    headers: {
      "Content-Type": "application/json",
      ...(await authorizationHeader()),
    },
    cache: "no-store",
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
