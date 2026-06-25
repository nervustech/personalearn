// This file configures the initialization of Sentry on the client.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { getClientSentryOptions } from "@/lib/sentry/config";

const options = getClientSentryOptions();

if (options) {
  Sentry.init({
    ...options,
    integrations: [Sentry.replayIntegration()],
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
