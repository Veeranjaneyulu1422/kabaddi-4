import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Flame } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Splash,
});

function Splash() {
  const { session, loading } = useAuth();
  if (!loading && session) return <Navigate to="/dashboard" />;

  return (
    <div className="arena-gradient flex min-h-dvh flex-col items-center justify-between px-6 pb-10 pt-20">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="flame-gradient mb-6 flex h-24 w-24 items-center justify-center rounded-3xl shadow-2xl shadow-primary/40">
          <Flame className="h-14 w-14 text-primary-foreground" strokeWidth={2.5} />
        </div>
        <h1 className="font-display text-6xl leading-none">
          KABADDI<span className="text-flame">·</span>ARENA
        </h1>
        <p className="mt-4 max-w-xs text-sm text-muted-foreground">
          Your personal performance scout. Log raids, tackles & stats — live from the mat.
        </p>
      </div>

      {!loading && (
        <div className="flex w-full max-w-sm flex-col gap-3">
          <Link
            to="/login"
            className="flame-gradient rounded-2xl py-4 text-center text-base font-bold uppercase tracking-wider text-primary-foreground shadow-lg shadow-primary/30 active:scale-[0.98]"
          >
            Enter the Arena
          </Link>
          <p className="text-center text-xs text-muted-foreground">
            Built for local tournaments
          </p>
        </div>
      )}
    </div>
  );
}
