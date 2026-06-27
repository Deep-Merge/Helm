import { NextResponse } from "next/server";
import { getBearerToken } from "@/lib/auth-token";

export async function GET() {
  const token = await getBearerToken();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    access_token: token,
    api_url: process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000",
  });
}
