import { NextResponse } from "next/server";
import { authorizationHeader } from "@/lib/auth-token";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const res = await fetch(`${API_URL}/admin/users/${id}/password`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(await authorizationHeader()),
    },
    body: JSON.stringify(body),
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
