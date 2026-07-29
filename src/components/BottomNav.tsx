import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Clock, Wallet, User } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/history", label: "History", icon: Clock },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-background/85 backdrop-blur-xl md:inset-x-auto md:left-1/2 md:bottom-6 md:-translate-x-1/2 md:rounded-full md:border md:shadow-lift">
      <div className="mx-auto flex max-w-md items-stretch justify-between px-6 pb-6 pt-2 md:w-[26rem] md:gap-2 md:px-4 md:pb-3 md:pt-3">
        {items.map(({ to, label, icon: Icon }) => {
          const active = pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium tracking-wide transition-colors",
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
    <div className="min-h-screen bg-background">
      <div className="mx-auto min-h-screen max-w-md pb-28 md:max-w-3xl lg:max-w-5xl md:pb-32">
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
