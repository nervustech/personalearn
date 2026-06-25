import { NextResponse } from "next/server";
import { ensureDevelopmentOnly } from "@/lib/sentry/dev-only";

class SentryVerificationError extends Error {
  constructor() {
    super("Sentry verification: intentional server-side test error");
    this.name = "SentryVerificationError";
  }
}

/** Throws a test error so you can confirm server events reach Sentry. Dev only. */
export async function GET() {
  ensureDevelopmentOnly();
  throw new SentryVerificationError();
}

export async function POST() {
  ensureDevelopmentOnly();
  return NextResponse.json({ ok: true });
}
