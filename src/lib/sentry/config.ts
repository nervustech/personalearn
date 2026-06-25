type SentryRuntime = "server" | "edge" | "client";

const isProduction = process.env.NODE_ENV === "production";

function getEnvironment() {
  return process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";
}

export function getSentryDsn(runtime: SentryRuntime): string | undefined {
  if (runtime === "client") {
    return process.env.NEXT_PUBLIC_SENTRY_DSN;
  }

  return process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
}

export function getBaseSentryOptions(runtime: SentryRuntime) {
  const dsn = getSentryDsn(runtime);

  if (!dsn) {
    return null;
  }

  return {
    dsn,
    environment: getEnvironment(),
    tracesSampleRate: isProduction ? 0.1 : 1,
    enableLogs: true,
    sendDefaultPii: false,
  };
}

export function getClientSentryOptions() {
  const base = getBaseSentryOptions("client");

  if (!base) {
    return null;
  }

  return {
    ...base,
    replaysSessionSampleRate: isProduction ? 0.01 : 0.1,
    replaysOnErrorSampleRate: isProduction ? 0.25 : 1,
  };
}
