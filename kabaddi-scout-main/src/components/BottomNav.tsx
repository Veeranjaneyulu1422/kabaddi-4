import { Link, useLocation } from "@tanstack/react-router";
import { Home, Plus, User } from "lucide-react";

export function BottomNav() {
  const { pathname } = useLocation();
  const items: Array<{ to: string; icon: typeof Home; label: string; primary?: boolean }> = [
    { to: "/dashboard", icon: Home, label: "Matches" },
    { to: "/match/new", icon: Plus, label: "New", primary: true },
    { to: "/profile", icon: User, label: "Profile" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-md items-center justify-around px-2 py-2">
        {items.map((it) => {
          const active = pathname.startsWith(it.to);
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-all ${
                it.primary
                  ? "flame-gradient -mt-6 px-5 py-3 text-primary-foreground shadow-lg shadow-primary/40"
                  : active
                    ? "text-primary"
                    : "text-muted-foreground"
              }`}
            >
              <Icon className={it.primary ? "h-6 w-6" : "h-5 w-5"} strokeWidth={2.5} />
              <span>{it.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
