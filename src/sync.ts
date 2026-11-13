import { merge } from "./merge";
import { parseHabits, type Habit, type KeyValueStore } from "./store";
import { generateSyncCode, normalizeSyncCode } from "./syncCode";

export type SyncStatus = "off" | "syncing" | "synced" | "offline" | "error";

export const SYNC_CODE_KEY = "streaks:sync-code";
const DEBOUNCE_MS = 1500;

/** Sends this device's habits, returns the server's merged copy. */
export type Transport = (code: string, habits: Habit[]) => Promise<Habit[]>;

/** The request never reached the server: no signal, airplane mode, DNS. Retry later. */
export class OfflineError extends Error {
  constructor() {
    super("offline");
  }
}

export function httpTransport(baseUrl: string, fetchFn: typeof fetch = fetch): Transport {
  const url = `${baseUrl.replace(/\/+$/, "")}/sync`;
  return async (code, habits) => {
    let response: Response;
    try {
      response = await fetchFn(url, {
        method: "POST",
        headers: { authorization: `Bearer ${code}`, "content-type": "application/json" },
        body: JSON.stringify({ habits }),
      });
    } catch {
      throw new OfflineError();
    }
    if (!response.ok) throw new Error(`Sync server replied ${response.status}`);
    const body = (await response.json().catch(() => null)) as { habits?: unknown } | null;
    const remote = parseHabits(body?.habits);
    // A bad reply must never replace good local data.
    if (!remote) throw new Error("Sync server sent malformed data");
    return remote;
  };
}

export interface SyncerOptions {
  storage: KeyValueStore;
  /** null when this build has no sync server configured. */
  transport: Transport | null;
  getHabits(): Habit[];
  /** Apply merged data. Must not count as a user change (or every sync would trigger another). */
  setHabits(habits: Habit[]): void;
  onStatus?(status: SyncStatus): void;
}

export function createSyncer({ storage, transport, getHabits, setHabits, onStatus }: SyncerOptions) {
  let code: string | null = storage.getItem(SYNC_CODE_KEY) || null;
  let status: SyncStatus = "off";
  let running: Promise<void> | null = null;
  let again = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function setStatus(next: SyncStatus) {
    status = next;
    onStatus?.(next);
  }

  async function runOnce(activeCode: string, send: Transport) {
    setStatus("syncing");
    try {
      const remote = await send(activeCode, getHabits());
      if (code !== activeCode) return; // turned off or switched code mid-flight
      // Merge with *current* local data: the user may have changed something while we waited.
      setHabits(merge(getHabits(), remote));
      setStatus("synced");
    } catch (error) {
      if (code === activeCode) setStatus(error instanceof OfflineError ? "offline" : "error");
    }
  }

  /** Syncs now. If a sync is already running, one more runs after it (never two at once). */
  function syncNow(): Promise<void> {
    if (!code || !transport) return Promise.resolve();
    if (running) {
      again = true;
      return running;
    }
    const send = transport;
    running = (async () => {
      do {
        again = false;
        if (!code) break;
        await runOnce(code, send);
      } while (again);
      running = null;
    })();
    return running;
  }

  function setCode(next: string | null) {
    code = next;
    storage.setItem(SYNC_CODE_KEY, next ?? "");
  }

  return {
    state: () => ({ status: code ? status : ("off" as SyncStatus), code, available: transport !== null }),
    syncNow,

    /** After a local change: wait for a pause, so a burst of taps is one request. */
    scheduleSoon() {
      if (!code) return;
      clearTimeout(timer);
      timer = setTimeout(() => void syncNow(), DEBOUNCE_MS);
    },

    turnOn(): string {
      const fresh = generateSyncCode();
      setCode(fresh);
      void syncNow();
      return fresh;
    },

    /** Returns an error message, or null on success. */
    join(input: string): string | null {
      const normalized = normalizeSyncCode(input);
      if (!normalized) return "That doesn't look like a sync code. It has 20 letters and digits.";
      setCode(normalized);
      void syncNow();
      return null;
    },

    turnOff() {
      clearTimeout(timer);
      setCode(null);
      setStatus("off");
    },
  };
}

export type Syncer = ReturnType<typeof createSyncer>;
