import { NextResponse } from "next/server";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function jsonOk<T>(body: T, init?: ResponseInit) {
  return NextResponse.json(body, { status: 200, ...init });
}
