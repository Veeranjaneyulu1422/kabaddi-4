import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { KabaddiCourt, type CourtPoint } from "@/components/KabaddiCourt";
import { enqueue, flush, pendingCount } from "@/lib/offline-queue";
import { toPng } from "html-to-image";
import {
  ArrowLeft, Undo2, Wifi, WifiOff, Activity, BarChart3, MapPin, Award, Download, Share2, Flame,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/match/$matchId")({
  component: MatchPage,
});

type EventType =
  | "empty_raid" | "touch_point" | "bonus_point" | "super_raid" | "failed_raid"
  | "successful_tackle" | "failed_tackle" | "super_tackle";

const EVENT_META: Record<EventType, { label: string; points: number; success: boolean; kind: "raid" | "tackle"; tone: "primary" | "success" | "destructive" | "warning" }> = {
  empty_raid:        { label: "Empty Raid",   points: 0, success: false, kind: "raid",   tone: "warning" },
  touch_point:       { label: "Touch Point",  points: 1, success: true,  kind: "raid",   tone: "primary" },
  bonus_point:       { label: "Bonus Point",  points: 1, success: true,  kind: "raid",   tone: "primary" },
  super_raid:        { label: "Super Raid",   points: 3, success: true,  kind: "raid",   tone: "success" },
  failed_raid:       { label: "Failed Raid",  points: 0, success: false, kind: "raid",   tone: "destructive" },
  successful_tackle: { label: "Tackle",       points: 1, success: true,  kind: "tackle", tone: "primary" },
  failed_tackle:     { label: "Failed Tackle",points: 0, success: false, kind: "tackle", tone: "destructive" },
  super_tackle:      { label: "Super Tackle", points: 2, success: true,  kind: "tackle", tone: "success" },
};

type Player = { id: string; name: string; team: string };
type Match = { id: string; team_a: string; team_b: string; tournament: string | null; match_date: string };
type DBEvent = {
  id: string; match_id: string; player_id: string | null;
  event_type: string; event_time: string; x_coord: number | null; y_coord: number | null; points: number;
};

type Tab = "logger" | "analytics" | "heatmap" | "card";

function MatchPage() {
  const { matchId } = Route.useParams();
  const { user } = useAuth();
  const [match, setMatch] = useState<Match | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [events, setEvents] = useState<DBEvent[]>([]);
  const [profile, setProfile] = useState<{ name: string; team_name: string } | null>(null);
  const [activePlayer, setActivePlayer] = useState<string | null>(null);
  const [pendingCoord, setPendingCoord] = useState<{ x: number; y: number } | null>(null);
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [tab, setTab] = useState<Tab>("logger");

  // Load
  useEffect(() => {
    (async () => {
      const [{ data: m }, { data: ps }, { data: ev }, { data: prof }] = await Promise.all([
        supabase.from("matches").select("*").eq("id", matchId).single(),
        supabase.from("players").select("*").eq("match_id", matchId).order("created_at"),
        supabase.from("match_events").select("*").eq("match_id", matchId).order("event_time"),
        supabase.from("profiles").select("name,team_name").eq("id", user!.id).maybeSingle(),
      ]);
      if (m) setMatch(m as Match);
      setPlayers((ps ?? []) as Player[]);
      setEvents((ev ?? []) as DBEvent[]);
      if (prof) setProfile(prof as any);
      const c = await pendingCount();
      setPending(c);
    })();
  }, [matchId, user]);

  useEffect(() => {
    const u = () => setOnline(navigator.onLine);
    window.addEventListener("online", u);
    window.addEventListener("offline", u);
    return () => { window.removeEventListener("online", u); window.removeEventListener("offline", u); };
  }, []);

  const logEvent = useCallback(async (type: EventType) => {
    const meta = EVENT_META[type];
    const localId = crypto.randomUUID();
    const now = new Date().toISOString();
    const optimistic: DBEvent = {
      id: localId, match_id: matchId, player_id: activePlayer,
      event_type: type, event_time: now,
      x_coord: pendingCoord?.x ?? null, y_coord: pendingCoord?.y ?? null,
      points: meta.points,
    };
    setEvents((e) => [...e, optimistic]);
    setPendingCoord(null);

    // Try direct insert; fallback to queue
    const { data, error } = await supabase.from("match_events").insert({
      match_id: matchId, player_id: activePlayer,
      event_type: type, event_time: now,
      x_coord: optimistic.x_coord, y_coord: optimistic.y_coord, points: meta.points,
    }).select().single();

    if (error || !data) {
      await enqueue({
        localId, match_id: matchId, player_id: activePlayer,
        event_type: type, event_time: now,
        x_coord: optimistic.x_coord, y_coord: optimistic.y_coord, points: meta.points,
      });
      setPending((p) => p + 1);
      toast.message("Saved offline — will sync");
    } else {
      setEvents((e) => e.map((x) => (x.id === localId ? (data as DBEvent) : x)));
    }
  }, [matchId, activePlayer, pendingCoord]);

  const undo = async () => {
    const last = events[events.length - 1];
    if (!last) return;
    setEvents((e) => e.slice(0, -1));
    await supabase.from("match_events").delete().eq("id", last.id);
  };

  const trySync = async () => {
    const n = await flush();
    setPending(await pendingCount());
    if (n > 0) {
      toast.success(`${n} event${n > 1 ? "s" : ""} synced`);
      // refresh
      const { data: ev } = await supabase.from("match_events").select("*").eq("match_id", matchId).order("event_time");
      setEvents((ev ?? []) as DBEvent[]);
    } else if (pending === 0) {
      toast.message("Nothing to sync");
    }
  };

  if (!match) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="font-display text-xl text-muted-foreground">Loading match…</div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-6 pt-10">
      <div className="flex items-center justify-between">
        <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Matches
        </Link>
        <button onClick={trySync} className="flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-xs font-semibold">
          {online ? <Wifi className="h-3.5 w-3.5 text-success" /> : <WifiOff className="h-3.5 w-3.5 text-destructive" />}
          {pending > 0 ? <span className="text-warning">{pending} pending</span> : <span className="text-muted-foreground">Synced</span>}
        </button>
      </div>

      <h1 className="mt-3 font-display text-3xl leading-tight">
        {match.team_a} <span className="text-flame">vs</span> {match.team_b}
      </h1>
      <p className="text-xs text-muted-foreground">
        {match.tournament ? `${match.tournament} · ` : ""}{new Date(match.match_date).toLocaleDateString()}
      </p>

      {/* Tabs */}
      <div className="mt-4 grid grid-cols-4 gap-1 rounded-2xl bg-card p-1">
        {([
          { k: "logger", label: "Log", Icon: Activity },
          { k: "analytics", label: "Stats", Icon: BarChart3 },
          { k: "heatmap", label: "Map", Icon: MapPin },
          { k: "card", label: "Card", Icon: Award },
        ] as const).map(({ k, label, Icon }) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`flex flex-col items-center gap-0.5 rounded-xl py-2 text-[11px] font-bold uppercase tracking-wider transition-all ${
              tab === k ? "flame-gradient text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === "logger" && (
          <LoggerTab
            players={players}
            activePlayer={activePlayer}
            setActivePlayer={setActivePlayer}
            pendingCoord={pendingCoord}
            setPendingCoord={setPendingCoord}
            logEvent={logEvent}
            events={events}
            undo={undo}
          />
        )}
        {tab === "analytics" && <AnalyticsTab events={events} players={players} />}
        {tab === "heatmap" && <HeatmapTab events={events} />}
        {tab === "card" && (
          <CardTab
            match={match}
            events={events}
            playerName={profile?.name || "Player"}
            teamName={profile?.team_name || match.team_a}
          />
        )}
      </div>
    </div>
  );
}

/* ---------- LOGGER ---------- */

function LoggerTab(props: {
  players: Player[];
  activePlayer: string | null;
  setActivePlayer: (id: string | null) => void;
  pendingCoord: { x: number; y: number } | null;
  setPendingCoord: (p: { x: number; y: number } | null) => void;
  logEvent: (t: EventType) => void;
  events: DBEvent[];
  undo: () => void;
}) {
  const { players, activePlayer, setActivePlayer, pendingCoord, setPendingCoord, logEvent, events, undo } = props;
  const raids: EventType[] = ["touch_point", "bonus_point", "super_raid", "empty_raid", "failed_raid"];
  const tackles: EventType[] = ["successful_tackle", "super_tackle", "failed_tackle"];

  return (
    <>
      {/* Player chips */}
      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex gap-2 pb-1">
          <Chip active={activePlayer === null} onClick={() => setActivePlayer(null)}>Unassigned</Chip>
          {players.map((p) => (
            <Chip key={p.id} active={activePlayer === p.id} onClick={() => setActivePlayer(p.id)}>
              <span className="opacity-60 mr-1">{p.team}</span>{p.name}
            </Chip>
          ))}
          {players.length === 0 && (
            <span className="text-xs text-muted-foreground">No players added — events will be unassigned.</span>
          )}
        </div>
      </div>

      {/* Court tap → set coord, then any event uses it */}
      <div className="mt-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {pendingCoord ? `Coord set (${pendingCoord.x.toFixed(0)}, ${pendingCoord.y.toFixed(0)}) — log event below` : "Tap court to mark position (optional)"}
        </p>
        <KabaddiCourt
          onTap={(p) => setPendingCoord(p)}
          points={pendingCoord ? [{ ...pendingCoord, success: true }] : []}
        />
      </div>

      {/* Event buttons */}
      <Section title="Raids">
        <div className="grid grid-cols-2 gap-2">
          {raids.map((t) => <BigButton key={t} type={t} onClick={() => logEvent(t)} />)}
        </div>
      </Section>

      <Section title="Tackles">
        <div className="grid grid-cols-2 gap-2">
          {tackles.map((t) => <BigButton key={t} type={t} onClick={() => logEvent(t)} />)}
        </div>
      </Section>

      <button
        onClick={undo}
        disabled={events.length === 0}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3 text-sm font-semibold disabled:opacity-50"
      >
        <Undo2 className="h-4 w-4" /> Undo last event
      </button>

      {events.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Recent</p>
          <div className="space-y-1.5">
            {[...events].slice(-6).reverse().map((e) => {
              const m = EVENT_META[e.event_type as EventType];
              const player = players.find((p) => p.id === e.player_id);
              return (
                <div key={e.id} className="flex items-center justify-between rounded-xl bg-card px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${m?.success ? "bg-success" : "bg-destructive"}`} />
                    <span className="font-semibold">{m?.label ?? e.event_type}</span>
                    {player && <span className="text-xs text-muted-foreground">· {player.name}</span>}
                  </div>
                  <span className="text-xs text-muted-foreground">+{e.points}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
        active ? "flame-gradient text-primary-foreground shadow-md shadow-primary/30" : "bg-card text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function BigButton({ type, onClick }: { type: EventType; onClick: () => void }) {
  const meta = EVENT_META[type];
  const tone = {
    primary: "flame-gradient text-primary-foreground",
    success: "bg-success text-success-foreground",
    destructive: "bg-destructive text-destructive-foreground",
    warning: "bg-warning text-warning-foreground",
  }[meta.tone];
  return (
    <button
      onClick={onClick}
      className={`flex h-20 flex-col items-center justify-center rounded-2xl text-base font-bold uppercase tracking-wide shadow-lg active:scale-95 ${tone}`}
    >
      <span>{meta.label}</span>
      <span className="text-[10px] opacity-80">+{meta.points} pts</span>
    </button>
  );
}

/* ---------- ANALYTICS ---------- */

function computeStats(events: DBEvent[]) {
  let raids = 0, raidSuccess = 0;
  let tackles = 0, tackleSuccess = 0;
  let points = 0;
  for (const e of events) {
    const m = EVENT_META[e.event_type as EventType];
    if (!m) continue;
    points += e.points;
    if (m.kind === "raid") { raids++; if (m.success) raidSuccess++; }
    if (m.kind === "tackle") { tackles++; if (m.success) tackleSuccess++; }
  }
  return {
    points, raids, raidSuccess, raidFail: raids - raidSuccess,
    tackles, tackleSuccess,
    raidPct: raids ? Math.round((raidSuccess / raids) * 100) : 0,
    tacklePct: tackles ? Math.round((tackleSuccess / tackles) * 100) : 0,
  };
}

function AnalyticsTab({ events, players }: { events: DBEvent[]; players: Player[] }) {
  const overall = useMemo(() => computeStats(events), [events]);

  const perPlayer = useMemo(() => {
    return players.map((p) => ({
      player: p,
      ...computeStats(events.filter((e) => e.player_id === p.id)),
    })).filter((s) => s.raids + s.tackles > 0);
  }, [events, players]);

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Stat big label="Total Points" value={overall.points} />
        <Stat big label="Total Events" value={events.length} />
        <Stat label="Raid Success" value={`${overall.raidPct}%`} sub={`${overall.raidSuccess}/${overall.raids}`} />
        <Stat label="Tackle Success" value={`${overall.tacklePct}%`} sub={`${overall.tackleSuccess}/${overall.tackles}`} />
      </div>

      <div className="mt-5 rounded-2xl bg-card p-4">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Raid breakdown</p>
        <Bar label="Successful" value={overall.raidSuccess} total={overall.raids || 1} tone="success" />
        <Bar label="Failed" value={overall.raidFail} total={overall.raids || 1} tone="destructive" />
      </div>

      <div className="mt-5">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Player Stats</p>
        {perPlayer.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No per-player data yet. Tag a player in the logger to see breakdowns.
          </div>
        ) : (
          <div className="space-y-2">
            {perPlayer.map((s) => (
              <div key={s.player.id} className="rounded-2xl bg-card p-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">
                    <span className="text-flame mr-1.5">{s.player.team}</span>{s.player.name}
                  </p>
                  <span className="text-sm font-bold">{s.points} pts</span>
                </div>
                <div className="mt-1.5 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <span>Raids: <b className="text-foreground">{s.raidSuccess}/{s.raids}</b> ({s.raidPct}%)</span>
                  <span>Tackles: <b className="text-foreground">{s.tackleSuccess}/{s.tackles}</b> ({s.tacklePct}%)</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function Stat({ label, value, sub, big }: { label: string; value: string | number; sub?: string; big?: boolean }) {
  return (
    <div className={`rounded-2xl bg-card p-4 ${big ? "border border-primary/30" : ""}`}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display ${big ? "text-flame text-4xl" : "text-3xl"}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Bar({ label, value, total, tone }: { label: string; value: number; total: number; tone: "success" | "destructive" }) {
  const pct = Math.round((value / total) * 100);
  const color = tone === "success" ? "bg-success" : "bg-destructive";
  return (
    <div className="mb-2 last:mb-0">
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{value} ({pct}%)</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ---------- HEATMAP ---------- */

function HeatmapTab({ events }: { events: DBEvent[] }) {
  const points: CourtPoint[] = events
    .filter((e) => e.x_coord != null && e.y_coord != null)
    .map((e) => ({
      x: Number(e.x_coord),
      y: Number(e.y_coord),
      success: EVENT_META[e.event_type as EventType]?.success ?? false,
      type: e.event_type,
    }));
  const success = points.filter((p) => p.success).length;
  const fail = points.length - success;

  return (
    <>
      <KabaddiCourt points={points} />
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-card p-3">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-success" />
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Successful</span>
          </div>
          <p className="mt-1 font-display text-2xl">{success}</p>
        </div>
        <div className="rounded-2xl bg-card p-3">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-destructive" />
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Failed</span>
          </div>
          <p className="mt-1 font-display text-2xl">{fail}</p>
        </div>
      </div>
      {points.length === 0 && (
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Tap the court before logging events to build the heatmap.
        </p>
      )}
    </>
  );
}

/* ---------- PERFORMANCE CARD ---------- */

function CardTab({ match, events, playerName, teamName }: { match: Match; events: DBEvent[]; playerName: string; teamName: string }) {
  const stats = computeStats(events);
  const ref = useRef<HTMLDivElement>(null);

  const download = async () => {
    if (!ref.current) return;
    try {
      const url = await toPng(ref.current, { pixelRatio: 2, cacheBust: true });
      const a = document.createElement("a");
      a.href = url;
      a.download = `${playerName.replace(/\s+/g, "_")}_kabaddi_card.png`;
      a.click();
    } catch (e: any) {
      toast.error(e.message || "Could not generate image");
    }
  };

  const share = async () => {
    if (!ref.current) return;
    try {
      const url = await toPng(ref.current, { pixelRatio: 2, cacheBust: true });
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], "kabaddi-card.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "My Kabaddi Performance" });
      } else {
        download();
      }
    } catch (e: any) {
      if (e.name !== "AbortError") toast.error("Share failed");
    }
  };

  return (
    <>
      <div ref={ref} className="overflow-hidden rounded-3xl border border-primary/40 arena-gradient p-6">
        <div className="flex items-center justify-between">
          <div className="flame-gradient flex h-10 w-10 items-center justify-center rounded-xl">
            <Flame className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="font-display text-sm tracking-widest text-muted-foreground">KABADDI·ARENA</span>
        </div>

        <p className="mt-5 text-[10px] uppercase tracking-widest text-muted-foreground">Performance Card</p>
        <h2 className="font-display text-4xl leading-tight">{playerName}</h2>
        <p className="text-sm text-muted-foreground">{teamName}</p>

        <div className="mt-5 rounded-2xl bg-card/60 p-4 backdrop-blur">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Match</p>
          <p className="font-display text-lg">{match.team_a} vs {match.team_b}</p>
          <p className="text-xs text-muted-foreground">
            {match.tournament ? `${match.tournament} · ` : ""}{new Date(match.match_date).toLocaleDateString()}
          </p>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <CardStat label="Points" value={stats.points} />
          <CardStat label="Raid %" value={`${stats.raidPct}%`} />
          <CardStat label="Tackle %" value={`${stats.tacklePct}%`} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-center">
          <MiniStat label="Raids" value={`${stats.raidSuccess}/${stats.raids}`} />
          <MiniStat label="Tackles" value={`${stats.tackleSuccess}/${stats.tackles}`} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button onClick={download} className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3 font-semibold">
          <Download className="h-4 w-4" /> Download
        </button>
        <button onClick={share} className="flame-gradient flex items-center justify-center gap-2 rounded-2xl py-3 font-semibold text-primary-foreground">
          <Share2 className="h-4 w-4" /> Share
        </button>
      </div>
    </>
  );
}

function CardStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-card/60 py-3 backdrop-blur">
      <p className="font-display text-flame text-2xl">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-card/40 py-2">
      <p className="font-display text-lg">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
