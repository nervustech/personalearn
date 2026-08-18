export function getPostLoginPath(hasClasses: boolean) {
  return hasClasses ? "/dashboard" : "/onboarding";
}

export type LandingCtas = {
  signedIn: boolean;
  headerHref: string;
  headerLabel: string;
  primaryHref: string;
  secondaryHref: string;
  footerHref: string;
};

/** Landing CTAs stay public when signed out; signed-in teachers skip /dashboard when they have no class. */
export function getLandingCtas(
  signedIn: boolean,
  hasClasses: boolean
): LandingCtas {
  if (!signedIn) {
    return {
      signedIn: false,
      headerHref: "/login",
      headerLabel: "Sign in",
      primaryHref: "/login",
      secondaryHref: "/dashboard",
      footerHref: "/login",
    };
  }

  const dest = getPostLoginPath(hasClasses);
  return {
    signedIn: true,
    headerHref: dest,
    headerLabel: hasClasses ? "Open dashboard" : "Create class",
    primaryHref: dest,
    secondaryHref: dest,
    footerHref: dest,
  };
}
