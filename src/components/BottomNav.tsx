import { Link, useRouterState } from "@tanstack/react-router";
import { Home, CalendarDays, BarChart3, Wallet, User } from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { setNativeAtRootScreen } from "@/lib/native-session";

const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/planner", label: "Planner", icon: CalendarDays },
  { to: "/analytics", label: "Stats", icon: BarChart3 },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Home is the app's root destination — tell the native shell so the Android
  // back gesture minimises the app there instead of returning to a past screen.
  useEffect(() => {
    setNativeAtRootScreen(pathname === "/");
  }, [pathname]);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-background/85 backdrop-blur-xl md:border-t-0 md:bg-transparent md:backdrop-blur-none md:pb-4">
      <div
        className={cn(
          "mx-auto flex w-full max-w-md items-stretch justify-between px-3 pb-6 pt-2",
          // Tablets: a centred floating pill instead of a stretched edge-to-edge bar.
          "md:max-w-lg md:rounded-full md:border md:border-hairline md:bg-background/90 md:px-6 md:pb-2 md:shadow-lift md:backdrop-blur-xl",
        )}
      >
        {items.map(({ to, label, icon: Icon }) => {
          const active = pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium tracking-wide transition-colors sm:text-[11px]",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon
                className={cn("h-5 w-5 transition-transform", active && "scale-110")}
                strokeWidth={active ? 2.4 : 1.8}
              />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/**
 * App shell. Phone keeps the narrow single column; tablets get a wider,
 * comfortably padded content measure instead of a stretched phone layout.
 */
export function MobileShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh overflow-x-hidden bg-background">
      <div className="mx-auto w-full max-w-md overflow-x-hidden pb-28 md:max-w-2xl md:px-4 md:pb-32 lg:max-w-3xl">
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
