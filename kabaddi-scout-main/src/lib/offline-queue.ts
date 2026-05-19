import { openDB, type IDBPDatabase } from "idb";
import { supabase } from "@/integrations/supabase/client";

export type QueuedEvent = {
  localId: string;
  match_id: string;
  player_id: string | null;
  event_type: string;
  event_time: string;
  x_coord: number | null;
  y_coord: number | null;
  points: number;
};

let dbp: Promise<IDBPDatabase> | null = null;
function db() {
  if (!dbp) {
    dbp = openDB("kabaddi-arena", 1, {
      upgrade(d) {
        d.createObjectStore("queue", { keyPath: "localId" });
      },
    });
  }
  return dbp;
}

export async function enqueue(ev: QueuedEvent) {
  const d = await db();
  await d.put("queue", ev);
}

export async function pendingCount(): Promise<number> {
  const d = await db();
  return d.count("queue");
}

export async function flush(): Promise<number> {
  const d = await db();
  const all = (await d.getAll("queue")) as QueuedEvent[];
  if (!all.length) return 0;
  let synced = 0;
  for (const ev of all) {
    const { localId, ...payload } = ev;
    const { error } = await supabase.from("match_events").insert(payload);
    if (!error) {
      await d.delete("queue", localId);
      synced++;
    } else {
      break; // stop on first error (likely offline)
    }
  }
  return synced;
}

export function startAutoSync(onSync?: (n: number) => void) {
  const tryFlush = async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    const n = await flush();
    if (n > 0) onSync?.(n);
  };
  if (typeof window !== "undefined") {
    window.addEventListener("online", tryFlush);
    const id = window.setInterval(tryFlush, 15000);
    void tryFlush();
    return () => {
      window.removeEventListener("online", tryFlush);
      window.clearInterval(id);
    };
  }
  return () => {};
}
