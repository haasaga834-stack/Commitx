/** Parent page for the Android back gesture: one level up, ending at Home. */
const PARENTS: Record<string, string> = {
  "/settings": "/profile",
  "/wallet": "/profile",
  "/history": "/analytics",
  "/screen-time": "/analytics",
  "/group-study": "/group",
};

export function nativeBackParent(pathname: string): string {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (PARENTS[path]) return PARENTS[path];
  if (path.startsWith("/group/")) return "/group";
  return "/";
}
