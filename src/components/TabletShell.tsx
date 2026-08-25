import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  History,
  Home,
  Settings,
  User,
  Wallet,
} from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { setNativeAtRootScreen } from "@/lib/native-session";

const primary = [
  { to: "/", label: "Home", icon: Home },
  { to: "/planner", label: "Planner", icon: CalendarDays },
  { to: "/analytics", label: "Insights", icon: BarChart3 },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/profile", label: "Profile", icon: User },
] as const;

const secondary = [
  { to: "/academics", label: "Academics", icon: BookOpen },
  { to: "/history", label: "History", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function RailLink({
  to,
  label,
  icon: Icon,
  active,
}: {
  to: string;
  label: string;
  icon: typeof Home;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      replace
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-primary/12 text-primary"
          : "text-muted-foreground hover:bg-card hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors",
          active ? "bg-primary text-primary-foreground" : "bg-card text-foreground/70",
        )}
      >
        <Icon className="h-4.5 w-4.5" strokeWidth={active ? 2.3 : 1.8} />
      </span>
      <span className="min-w-0 truncate">{label}</span>
    </Link>
  );
}

/** Vertical navigation rail — the tablet replacement for the mobile tab bar. */
function NavRail() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    setNativeAtRootScreen(pathname === "/");
  }, [pathname]);

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-[15rem] flex-col overflow-y-auto overscroll-contain border-r border-hairline bg-background/95 px-4 py-6 backdrop-blur-xl lg:w-[16.5rem]">
      <Link to="/" replace className="flex items-center gap-2.5 px-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-base font-semibold text-primary-foreground">
          Cx
        </span>
        <span className="min-w-0">
          <span className="block font-display text-lg font-semibold leading-tight text-foreground">
            CommitX
          </span>
          <span className="block text-[11px] text-muted-foreground">
            Commit. Complete. Grow.
          </span>
        </span>
      </Link>

      <nav className="mt-7 flex flex-col gap-1">
        {primary.map((i) => (
          <RailLink key={i.to} {...i} active={pathname === i.to} />
        ))}
      </nav>

      <div className="mt-6 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        More
      </div>
      <nav className="mt-2 flex flex-col gap-1">
        {secondary.map((i) => (
          <RailLink key={i.to} {...i} active={pathname === i.to} />
        ))}
      </nav>

      <div className="mt-auto px-3 pt-6 text-[10px] text-muted-foreground">
        Cx Coins only · in-app points, no cash value
      </div>
    </aside>
  );
}

/**
 * Tablet app shell. Page scrolling stays on the document (no nested scroll
 * containers, no fixed heights) so a vertical swipe anywhere scrolls the page.
 */
export function TabletShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <NavRail />
      <main className="pl-[15rem] lg:pl-[16.5rem]">
        <div className="mx-auto w-full max-w-5xl px-8 py-8 lg:px-10 lg:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
