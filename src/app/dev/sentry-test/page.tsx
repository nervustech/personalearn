import Link from "next/link";
import { ensureDevelopmentOnly, SENTRY_ISSUES_URL } from "@/lib/sentry/dev-only";
import { SentryTestClient } from "./sentry-test-client";

export default function SentryTestPage() {
  ensureDevelopmentOnly();

  const dsnConfigured = Boolean(process.env.SENTRY_DSN);
  const publicDsnConfigured = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 p-6">
      <div>
        <p className="text-sm font-medium text-teal-700">Development only</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Sentry verification
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Trigger sample errors and confirm they appear in your Sentry Issues
          feed. This page returns 404 in production and preview builds.
        </p>
      </div>

      <dl className="rounded-lg border bg-card p-4 text-sm">
        <div className="flex justify-between gap-4 py-1">
          <dt className="text-muted-foreground">SENTRY_DSN (server)</dt>
          <dd className="font-medium">{dsnConfigured ? "set" : "missing"}</dd>
        </div>
        <div className="flex justify-between gap-4 py-1">
          <dt className="text-muted-foreground">NEXT_PUBLIC_SENTRY_DSN (client)</dt>
          <dd className="font-medium">
            {publicDsnConfigured ? "set" : "missing"}
          </dd>
        </div>
      </dl>

      {!publicDsnConfigured && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          Add <code className="font-mono">SENTRY_DSN</code> and{" "}
          <code className="font-mono">NEXT_PUBLIC_SENTRY_DSN</code> to{" "}
          <code className="font-mono">.env.local</code>, then restart{" "}
          <code className="font-mono">npm run dev</code>. Without a DSN,
          Sentry stays disabled and no events are sent.
        </p>
      )}

      <SentryTestClient />

      <p className="text-sm text-muted-foreground">
        After triggering an error, open{" "}
        <a
          href={SENTRY_ISSUES_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-teal-700 underline-offset-2 hover:underline"
        >
          Sentry Issues
        </a>{" "}
        (environment: <code className="font-mono">development</code>). Events
        can take a few seconds to appear.
      </p>

      <Link
        href="/"
        className="text-sm text-muted-foreground underline-offset-2 hover:underline"
      >
        ← Back to home
      </Link>
    </div>
  );
}
