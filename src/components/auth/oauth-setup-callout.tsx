"use client";

import { useEffect, useState } from "react";

type OAuthSetup = {
  googleAuthorizedRedirectUri: string;
  checklist: string[];
};

export function OAuthSetupCallout() {
  const [setup, setSetup] = useState<OAuthSetup | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/oauth-setup")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: OAuthSetup | null) => {
        if (!cancelled && data) setSetup(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!setup) return null;

  return (
    <div
      className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-3 text-sm text-warning"
      role="note"
    >
      <p className="font-medium">Google OAuth setup required (PSL-18)</p>
      <p className="mt-2 text-xs leading-relaxed opacity-90">
        Add this exact URI in Google Cloud Console → Credentials → Authorized
        redirect URIs:
      </p>
      <code className="mt-2 block break-all rounded-md bg-foreground/5 px-2 py-1.5 text-xs">
        {setup.googleAuthorizedRedirectUri}
      </code>
      <ul className="mt-3 list-disc space-y-1 pl-4 text-xs leading-relaxed opacity-90">
        {setup.checklist.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
