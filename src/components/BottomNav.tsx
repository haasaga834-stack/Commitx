import { Link, useRouterState } from "@tanstack/react-router";
import { Home, CalendarDays, BarChart3, Wallet, User } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/planner", label: "Planner", icon: CalendarDays },
  { to: "/analytics", label: "Stats", icon: BarChart3 },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-md items-stretch justify-between px-3 pb-6 pt-2 sm:max-w-2xl sm:px-8">
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

export function MobileShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <div className="mx-auto min-h-screen w-full max-w-md overflow-x-hidden pb-28 sm:max-w-2xl">{children}</div>
      <BottomNav />
    </div>
  );
}
