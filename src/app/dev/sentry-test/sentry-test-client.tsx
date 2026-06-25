"use client";

import * as Sentry from "@sentry/nextjs";
import { useState } from "react";
import { SENTRY_ISSUES_URL } from "@/lib/sentry/dev-only";

declare function myUndefinedFunction(): void;

export function SentryTestClient() {
  const [clientStatus, setClientStatus] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<string | null>(null);

  function triggerClientError() {
    setClientStatus(null);
    try {
      // Same pattern as Sentry docs: call a function that does not exist.
      myUndefinedFunction();
    } catch (error) {
      Sentry.captureException(error);
      setClientStatus(
        "Client error captured — check Sentry Issues (may take a few seconds)."
      );
    }
  }

  async function triggerServerError() {
    setServerStatus("Calling /api/dev/sentry-test…");
    try {
      const response = await fetch("/api/dev/sentry-test");
      if (!response.ok) {
        setServerStatus(
          `Expected ${response.status} — server error triggered. Check Sentry Issues (may take a few seconds).`
        );
      } else {
        setServerStatus("Unexpected success — route should have thrown.");
      }
    } catch {
      setServerStatus(
        "Request failed — if the dev server logged an error, check Sentry Issues."
      );
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={triggerClientError}
        className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
      >
        1. Trigger client error
      </button>
      {clientStatus && (
        <p className="text-sm text-muted-foreground">{clientStatus}</p>
      )}

      <button
        type="button"
        onClick={triggerServerError}
        className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium hover:bg-slate-50"
      >
        2. Trigger server error (API route)
      </button>
      {serverStatus && (
        <p className="text-sm text-muted-foreground">{serverStatus}</p>
      )}

      <a
        href={SENTRY_ISSUES_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-center text-sm font-medium text-teal-700 underline-offset-2 hover:underline"
      >
        Open Sentry Issues →
      </a>
    </div>
  );
}
