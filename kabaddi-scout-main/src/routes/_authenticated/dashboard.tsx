import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Calendar, ChevronRight, Trophy, Flame } from "lucide-react";

type Match = {
  id: string;
  team_a: string;
  team_b: string;
  tournament: string | null;
  match_date: string;
};

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [name, setName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: ms }, { data: prof }] = await Promise.all([
        supabase
          .from("matches")
          .select("id,team_a,team_b,tournament,match_date")
          .order("match_date", { ascending: false })
          .limit(50),
        supabase.from("profiles").select("name").eq("id", user!.id).maybeSingle(),
      ]);
      setMatches(ms ?? []);
      setName(prof?.name ?? "");
      setLoading(false);
    })();
  }, [user]);

  return (
    <div className="px-5 pb-6 pt-12">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Welcome back</p>
          <h1 className="font-display text-3xl">{name || "Player"}</h1>
        </div>
        <div className="flame-gradient flex h-12 w-12 items-center justify-center rounded-2xl">
          <Flame className="h-6 w-6 text-primary-foreground" strokeWidth={2.5} />
        </div>
      </div>

      <Link
        to="/match/new"
        className="mt-6 flex items-center justify-between rounded-2xl border border-primary/40 flame-gradient p-5 active:scale-[0.99]"
      >
        <div>
          <p className="font-display text-2xl text-primary-foreground">Start New Match</p>
          <p className="text-xs text-primary-foreground/80">Set up teams & start logging</p>
        </div>
        <ChevronRight className="h-7 w-7 text-primary-foreground" />
      </Link>

      <h2 className="mt-8 mb-3 font-display text-xl text-muted-foreground">Recent Matches</h2>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-card" />
          ))}
        </div>
      ) : matches.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <Trophy className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No matches yet — kick off your first one above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {matches.map((m) => (
            <Link
              key={m.id}
              to="/match/$matchId"
              params={{ matchId: m.id }}
              className="flex items-center justify-between rounded-2xl bg-card p-4 active:scale-[0.99]"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-lg">
                  {m.team_a} <span className="text-flame">vs</span> {m.team_b}
                </p>
                <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(m.match_date).toLocaleDateString()}</span>
                  {m.tournament && <span className="truncate">{m.tournament}</span>}
                </div>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
