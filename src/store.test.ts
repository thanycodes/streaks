import {
  addHabit,
  deleteHabit,
  doneDays,
  LEGACY_KEY,
  loadHabits,
  parseHabits,
  saveHabits,
  STORAGE_KEY,
  toggleDay,
  visibleHabits,
  type Habit,
  type KeyValueStore,
} from "./store";

const TODAY = "2026-11-11";
const NOW = 1_000_000;

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => void (data[k] = v),
  };
}

function habit(name: string, done: string[] = [], extra: Partial<Habit> = {}): Habit {
  const days = Object.fromEntries(done.map((d) => [d, { done: true, at: 1 }]));
  return { id: name, name, createdAt: TODAY, addedAt: 0, days, ...extra };
}

describe("addHabit", () => {
  it("adds a trimmed habit stamped with the change time", () => {
    const result = addHabit([], "  Read 20 min  ", TODAY, NOW);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.habits).toHaveLength(1);
      expect(result.habits[0]).toMatchObject({ name: "Read 20 min", createdAt: TODAY, addedAt: NOW, days: {} });
      expect(result.habits[0].id).toBeTruthy();
    }
  });

  it("rejects empty names", () => {
    expect(addHabit([], "   ", TODAY, NOW)).toEqual({ ok: false, error: "Name can't be empty." });
  });

  it("rejects case-insensitive duplicates", () => {
    expect(addHabit([habit("Read")], " read ", TODAY, NOW)).toEqual({ ok: false, error: "You already track that habit." });
  });

  it("allows reusing the name of a deleted habit", () => {
    expect(addHabit([habit("Read", [], { deleted: true })], "Read", TODAY, NOW).ok).toBe(true);
  });

  it("does not mutate the input", () => {
    const habits: Habit[] = [];
    addHabit(habits, "Walk", TODAY, NOW);
    expect(habits).toHaveLength(0);
  });
});

describe("toggleDay", () => {
  it("marks a day done, then records the undo instead of forgetting the day", () => {
    const once = toggleDay([habit("Read")], "Read", TODAY, NOW);
    expect(once[0].days[TODAY]).toEqual({ done: true, at: NOW });
    const twice = toggleDay(once, "Read", TODAY, NOW + 5);
    expect(twice[0].days[TODAY]).toEqual({ done: false, at: NOW + 5 });
    expect(doneDays(twice[0])).toEqual([]);
  });

  it("still moves the change time forward if the clock went backwards", () => {
    const once = toggleDay([habit("Read")], "Read", TODAY, NOW);
    const twice = toggleDay(once, "Read", TODAY, NOW - 100);
    expect(twice[0].days[TODAY]).toEqual({ done: false, at: NOW + 1 });
  });

  it("only touches the matching habit", () => {
    const result = toggleDay([habit("Read"), habit("Walk")], "Walk", TODAY, NOW);
    expect(doneDays(result[0])).toEqual([]);
    expect(doneDays(result[1])).toEqual([TODAY]);
  });
});

describe("deleteHabit", () => {
  it("leaves a hidden tombstone so the delete can sync", () => {
    const result = deleteHabit([habit("Read"), habit("Walk")], "Read");
    expect(result.find((h) => h.id === "Read")?.deleted).toBe(true);
    expect(visibleHabits(result).map((h) => h.name)).toEqual(["Walk"]);
  });
});

describe("views", () => {
  it("doneDays lists only days marked done, sorted", () => {
    const h = habit("Read", ["2026-11-10", "2026-11-08"]);
    h.days["2026-11-09"] = { done: false, at: 5 };
    expect(doneDays(h)).toEqual(["2026-11-08", "2026-11-10"]);
  });

  it("visibleHabits hides tombstones, ordered by when habits were added", () => {
    const habits = [habit("B", [], { addedAt: 2 }), habit("A", [], { addedAt: 1 }), habit("Gone", [], { deleted: true })];
    expect(visibleHabits(habits).map((h) => h.name)).toEqual(["A", "B"]);
  });
});

describe("persistence", () => {
  it("round-trips habits under the v2 key", () => {
    const storage = memoryStore();
    const habits = [habit("Read", [TODAY])];
    saveHabits(storage, habits);
    expect(STORAGE_KEY).toBe("streaks:v2");
    expect(loadHabits(storage)).toEqual(habits);
  });

  it("returns [] when nothing is stored", () => {
    expect(loadHabits(memoryStore())).toEqual([]);
  });

  it("returns [] on corrupt JSON", () => {
    expect(loadHabits(memoryStore({ [STORAGE_KEY]: "{not json" }))).toEqual([]);
  });

  it("returns [] when the stored shape is wrong", () => {
    expect(loadHabits(memoryStore({ [STORAGE_KEY]: '{"a":1}' }))).toEqual([]);
    expect(loadHabits(memoryStore({ [STORAGE_KEY]: '[{"name":5}]' }))).toEqual([]);
  });
});

describe("upgrade from v1", () => {
  const v1 = JSON.stringify([
    { id: "a", name: "Read", createdAt: "2026-11-01", done: ["2026-11-09", "2026-11-10"] },
    { id: "b", name: "Walk", createdAt: "2026-11-02", done: [] },
  ]);

  it("converts v1 data, keeping order and done days", () => {
    const habits = loadHabits(memoryStore({ [LEGACY_KEY]: v1 }));
    expect(visibleHabits(habits).map((h) => h.name)).toEqual(["Read", "Walk"]);
    expect(doneDays(habits[0])).toEqual(["2026-11-09", "2026-11-10"]);
    // Change time 0 means "older than any real change", so edits made anywhere after the upgrade win.
    expect(habits[0].days["2026-11-09"].at).toBe(0);
  });

  it("leaves the v1 data in place as a backup", () => {
    const storage = memoryStore({ [LEGACY_KEY]: v1 });
    saveHabits(storage, loadHabits(storage));
    expect(storage.data[LEGACY_KEY]).toBe(v1);
    expect(storage.data[STORAGE_KEY]).toBeTruthy();
  });

  it("prefers v2 data once it exists", () => {
    const storage = memoryStore({ [LEGACY_KEY]: v1, [STORAGE_KEY]: JSON.stringify([habit("Swim")]) });
    expect(loadHabits(storage).map((h) => h.name)).toEqual(["Swim"]);
  });

  it("returns [] for corrupt v1 data", () => {
    expect(loadHabits(memoryStore({ [LEGACY_KEY]: '[{"id":1}]' }))).toEqual([]);
  });
});

describe("parseHabits", () => {
  it("accepts valid v2 data and rejects anything else", () => {
    expect(parseHabits([habit("Read", [TODAY])])).toHaveLength(1);
    expect(parseHabits({})).toBeNull();
    expect(parseHabits([{ ...habit("Read"), days: { [TODAY]: { done: "yes", at: 1 } } }])).toBeNull();
    expect(parseHabits([{ ...habit("Read"), deleted: "no" }])).toBeNull();
  });
});

describe("ids without a secure context", () => {
  it("still creates unique ids when crypto.randomUUID is unavailable", () => {
    // Phones loading the app over http://192.168.x.x have no randomUUID.
    const original = crypto.randomUUID;
    Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true });
    try {
      const first = addHabit([], "Read", TODAY, NOW);
      const second = first.ok ? addHabit(first.habits, "Walk", TODAY, NOW) : first;
      expect(second.ok).toBe(true);
      if (second.ok) {
        const [a, b] = second.habits.map((h) => h.id);
        expect(a).toBeTruthy();
        expect(a).not.toBe(b);
      }
    } finally {
      Object.defineProperty(crypto, "randomUUID", { value: original, configurable: true });
    }
  });
});
