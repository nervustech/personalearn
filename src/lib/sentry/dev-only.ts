import { notFound } from "next/navigation";

/** Dev-only Sentry verification routes. Returns 404 outside local development. */
export function ensureDevelopmentOnly() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }
}

export const SENTRY_ISSUES_URL =
  "https://nervus.sentry.io/issues/?project=4511624890220544";
