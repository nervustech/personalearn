export function getPostLoginPath(hasClasses: boolean) {
  return hasClasses ? "/dashboard" : "/onboarding";
}
