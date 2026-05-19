import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { BottomNav } from "@/components/BottomNav";
import { startAutoSync, pendingCount } from "@/lib/offline-queue";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: AuthLayout,
});

function AuthLayout() {
  const { loading, session } = useAuth();

  useEffect(() => {
    const stop = startAutoSync((n) => toast.success(`${n} event${n > 1 ? "s" : ""} synced`));
    pendingCount().then((n) => {
      if (n > 0) toast.message(`${n} pending event${n > 1 ? "s" : ""} — will sync`);
    });
    return stop;
  }, []);

  if (loading || !session) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="font-display text-2xl text-flame">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background pb-24">
      <div className="mx-auto max-w-md">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}
