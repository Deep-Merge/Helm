import { NextResponse } from "next/server";
import { authorizationHeader } from "@/lib/auth-token";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const res = await fetch(`${API_URL}/admin/users/${id}`, {
    method: "DELETE",
    headers: await authorizationHeader(),
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
