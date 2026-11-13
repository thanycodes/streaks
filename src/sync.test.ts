import { createSyncer, httpTransport, OfflineError, SYNC_CODE_KEY, type Transport } from "./sync";
import { merge } from "./merge";
import type { Habit, KeyValueStore } from "./store";

const CODE = "ABCDEFGHJKMNPQRSTVWX";

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}

function habit(id: string, day = "2026-11-11", at = 1): Habit {
  return { id, name: id, createdAt: day, addedAt: at, days: { [day]: { done: true, at } } };
}

/** A fake Worker: merges and remembers, like the real one. */
function fakeServer(initial: Habit[] = []) {
  let stored = initial;
  const calls: string[] = [];
  const transport: Transport = async (code, habits) => {
    calls.push(code);
    stored = merge(stored, habits);
    return stored;
  };
  return { transport, calls, stored: () => stored };
}

function setup(opts: { transport?: Transport | null; storage?: KeyValueStore; local?: Habit[] } = {}) {
  let local = opts.local ?? [];
  const statuses: string[] = [];
  const storage = opts.storage ?? memoryStore();
  const syncer = createSyncer({
    storage,
    transport: opts.transport === undefined ? fakeServer().transport : opts.transport,
    getHabits: () => local,
    setHabits: (next) => void (local = next),
    onStatus: (status) => statuses.push(status),
  });
  return { syncer, storage, statuses, local: () => local, setLocal: (h: Habit[]) => void (local = h) };
}

describe("turning sync on and off", () => {
  it("is off until a code is set", () => {
    expect(setup().syncer.state()).toMatchObject({ status: "off", code: null, available: true });
  });

  it("reports unavailable when the build has no server", () => {
    expect(setup({ transport: null }).syncer.state().available).toBe(false);
  });

  it("turnOn creates a code, remembers it and uploads local habits", async () => {
    const server = fakeServer();
    const { syncer, storage } = setup({ transport: server.transport, local: [habit("read")] });
    const code = syncer.turnOn();
    expect(code).toMatch(/^[0-9A-Z]{20}$/);
    expect(storage.getItem(SYNC_CODE_KEY)).toBe(code);
    await syncer.syncNow();
    expect(server.stored().map((h) => h.id)).toEqual(["read"]);
    expect(syncer.state().status).toBe("synced");
  });

  it("join combines this device's habits with the cloud copy", async () => {
    const server = fakeServer([habit("walk")]);
    const { syncer, local } = setup({ transport: server.transport, local: [habit("read")] });
    expect(syncer.join("abcde-fghjk-mnpqr-stvwx")).toBeNull();
    await syncer.syncNow();
    expect(local().map((h) => h.id)).toEqual(["read", "walk"]);
    expect(server.calls.at(-1)).toBe(CODE);
  });

  it("join rejects a code that can't be valid", () => {
    const { syncer } = setup();
    expect(syncer.join("nope")).toBe("That doesn't look like a sync code. It has 20 letters and digits.");
    expect(syncer.state().code).toBeNull();
  });

  it("turnOff forgets the code and keeps local data", () => {
    const { syncer, storage, local } = setup({ local: [habit("read")] });
    syncer.turnOn();
    syncer.turnOff();
    expect(syncer.state()).toMatchObject({ status: "off", code: null });
    expect(storage.getItem(SYNC_CODE_KEY)).toBe("");
    expect(local()).toHaveLength(1);
  });

  it("remembers the code across restarts", () => {
    expect(setup({ storage: memoryStore({ [SYNC_CODE_KEY]: CODE }) }).syncer.state().code).toBe(CODE);
  });
});

describe("syncNow", () => {
  it("does nothing while sync is off", async () => {
    const server = fakeServer();
    await setup({ transport: server.transport }).syncer.syncNow();
    expect(server.calls).toEqual([]);
  });

  it("shows syncing, then synced", async () => {
    const { syncer, statuses } = setup({ storage: memoryStore({ [SYNC_CODE_KEY]: CODE }) });
    await syncer.syncNow();
    expect(statuses).toEqual(["syncing", "synced"]);
  });

  it("reports offline when the network is down, and keeps local data", async () => {
    const transport: Transport = async () => {
      throw new OfflineError();
    };
    const { syncer, local } = setup({ transport, storage: memoryStore({ [SYNC_CODE_KEY]: CODE }), local: [habit("read")] });
    await syncer.syncNow();
    expect(syncer.state().status).toBe("offline");
    expect(local()).toHaveLength(1);
  });

  it("reports an error for anything else, and keeps local data", async () => {
    const transport: Transport = async () => {
      throw new Error("500");
    };
    const { syncer, local } = setup({ transport, storage: memoryStore({ [SYNC_CODE_KEY]: CODE }), local: [habit("read")] });
    await syncer.syncNow();
    expect(syncer.state().status).toBe("error");
    expect(local()).toHaveLength(1);
  });

  it("never loses a change made while a sync was in flight", async () => {
    let release!: () => void;
    let held = true;
    const server = fakeServer([habit("walk")]);
    // Only the first request is held back, so we can change data while it's in flight.
    const slow: Transport = async (code, habits) => {
      if (held) {
        held = false;
        await new Promise<void>((resolve) => (release = resolve));
      }
      return server.transport(code, habits);
    };
    const t = setup({ transport: slow, storage: memoryStore({ [SYNC_CODE_KEY]: CODE }), local: [habit("read")] });
    const done = t.syncer.syncNow();
    await Promise.resolve();
    t.setLocal([...t.local(), habit("swim")]); // user adds a habit mid-sync
    void t.syncer.syncNow(); // queued behind the running one, not run in parallel
    release();
    await done;
    expect(t.local().map((h) => h.id).sort()).toEqual(["read", "swim", "walk"]);
    expect(server.stored().map((h) => h.id).sort()).toEqual(["read", "swim", "walk"]);
  });
});

describe("scheduleSoon", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("batches a burst of changes into one sync", async () => {
    const server = fakeServer();
    const { syncer } = setup({ transport: server.transport, storage: memoryStore({ [SYNC_CODE_KEY]: CODE }) });
    syncer.scheduleSoon();
    syncer.scheduleSoon();
    syncer.scheduleSoon();
    expect(server.calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(2000);
    expect(server.calls).toHaveLength(1);
  });
});

describe("httpTransport", () => {
  const habits = [habit("read")];

  it("posts habits with the code and returns the validated reply", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ habits }), { status: 200 }));
    const result = await httpTransport("https://sync.example/", fetchFn)(CODE, habits);
    expect(result).toEqual(habits);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://sync.example/sync");
    expect(new Headers(init.headers).get("authorization")).toBe(`Bearer ${CODE}`);
  });

  it("turns a network failure into OfflineError", async () => {
    const fetchFn = async () => {
      throw new TypeError("Failed to fetch");
    };
    await expect(httpTransport("https://x", fetchFn)(CODE, habits)).rejects.toBeInstanceOf(OfflineError);
  });

  it("rejects a corrupt reply instead of returning it", async () => {
    const fetchFn = async () => new Response(JSON.stringify({ habits: [{ id: 1 }] }), { status: 200 });
    await expect(httpTransport("https://x", fetchFn)(CODE, habits)).rejects.toThrow("malformed");
  });

  it("rejects an error status", async () => {
    const fetchFn = async () => new Response("nope", { status: 500 });
    await expect(httpTransport("https://x", fetchFn)(CODE, habits)).rejects.toThrow("500");
  });
});
