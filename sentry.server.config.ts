// This file configures the initialization of Sentry on the server.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { getBaseSentryOptions } from "@/lib/sentry/config";

const options = getBaseSentryOptions("server");

if (options) {
  Sentry.init(options);
}
