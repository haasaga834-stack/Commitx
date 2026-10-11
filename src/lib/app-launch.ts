/** Only release the native cover when auth has settled on its destination. */
export function isNativeLaunchReady(loading: boolean, hasUser: boolean, pathname: string) {
  if (loading) return false;
  if (pathname === "/" && !hasUser) return false;
  if (pathname === "/auth" && hasUser) return false;
  return true;
}

export function shouldShowNativeWelcome(pathname: string, hasActiveSession: boolean) {
  return pathname === "/" && !hasActiveSession;
}