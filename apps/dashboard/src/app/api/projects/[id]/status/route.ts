import { NextResponse } from "next/server";
import { authorizationHeader } from "@/lib/auth-token";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function isAbortedError(error: unknown): boolean {
  if (error instanceof Error) {
    if (error.name === "AbortError") return true;
    if (error.message === "aborted" || error.message === "This operation was aborted") {
      return true;
    }
  }
  return false;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const res = await fetch(`${API_URL}/projects/${id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(await authorizationHeader()),
      },
      body: JSON.stringify(body),
      signal: request.signal,
    });

    if (request.signal.aborted) {
      return new NextResponse(null, { status: 499 });
    }

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    if (request.signal.aborted || isAbortedError(error)) {
      return new NextResponse(null, { status: 499 });
    }
    throw error;
  }
}
