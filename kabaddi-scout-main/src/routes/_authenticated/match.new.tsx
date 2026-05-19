import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/match/new")({
  component: NewMatch,
});

function NewMatch() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [tournament, setTournament] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [playersA, setPlayersA] = useState("");
  const [playersB, setPlayersB] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: match, error } = await supabase
        .from("matches")
        .insert({
          user_id: user!.id,
          team_a: teamA,
          team_b: teamB,
          tournament: tournament || null,
          match_date: date,
        })
        .select()
        .single();
      if (error) throw error;

      const players = [
        ...playersA.split(",").map((n) => n.trim()).filter(Boolean).map((name) => ({ match_id: match.id, name, team: "A" as const })),
        ...playersB.split(",").map((n) => n.trim()).filter(Boolean).map((name) => ({ match_id: match.id, name, team: "B" as const })),
      ];
      if (players.length) {
        await supabase.from("players").insert(players);
      }
      toast.success("Match created!");
      navigate({ to: "/match/$matchId", params: { matchId: match.id } });
    } catch (err: any) {
      toast.error(err.message || "Failed to create match");
      setLoading(false);
    }
  };

  return (
    <div className="px-5 pb-6 pt-12">
      <Link to="/dashboard" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <h1 className="font-display text-4xl">New Match</h1>
      <p className="mt-1 text-sm text-muted-foreground">Set up the matchup</p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Team A" value={teamA} onChange={setTeamA} placeholder="Raiders" required />
          <Field label="Team B" value={teamB} onChange={setTeamB} placeholder="Warriors" required />
        </div>
        <Field label="Tournament" value={tournament} onChange={setTournament} placeholder="District Cup" />
        <Field label="Match date" type="date" value={date} onChange={setDate} required />

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Team A players <span className="opacity-60">(comma separated)</span>
          </label>
          <textarea
            value={playersA}
            onChange={(e) => setPlayersA(e.target.value)}
            rows={2}
            placeholder="Ravi, Suresh, Arjun"
            className="w-full resize-none rounded-2xl border border-border bg-input px-4 py-3 outline-none focus:border-primary"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Team B players <span className="opacity-60">(comma separated)</span>
          </label>
          <textarea
            value={playersB}
            onChange={(e) => setPlayersB(e.target.value)}
            rows={2}
            placeholder="Kiran, Manoj, Vivek"
            className="w-full resize-none rounded-2xl border border-border bg-input px-4 py-3 outline-none focus:border-primary"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flame-gradient flex w-full items-center justify-center gap-2 rounded-2xl py-4 font-bold uppercase tracking-wider text-primary-foreground shadow-lg shadow-primary/30 active:scale-[0.98] disabled:opacity-60"
        >
          {loading && <Loader2 className="h-5 w-5 animate-spin" />}
          Start Match
        </button>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", required }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-2xl border border-border bg-input px-4 py-3.5 outline-none focus:border-primary"
      />
    </div>
  );
}
