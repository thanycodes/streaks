import { addHabit, deleteHabit, loadHabits, saveHabits, STORAGE_KEY, toggleDay, type Habit, type KeyValueStore } from "./store";

const TODAY = "2026-11-11";

function memoryStore(initial: Record<string, string> = {}): KeyValueStore {
  const data = { ...initial };
  return {
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => void (data[k] = v),
  };
}

function habit(name: string, done: string[] = []): Habit {
  return { id: name, name, createdAt: TODAY, done };
}

describe("addHabit", () => {
  it("adds a trimmed habit", () => {
    const result = addHabit([], "  Read 20 min  ", TODAY);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.habits).toHaveLength(1);
      expect(result.habits[0]).toMatchObject({ name: "Read 20 min", createdAt: TODAY, done: [] });
      expect(result.habits[0].id).toBeTruthy();
    }
  });

  it("rejects empty names", () => {
    expect(addHabit([], "   ", TODAY)).toEqual({ ok: false, error: "Name can't be empty." });
  });

  it("rejects case-insensitive duplicates", () => {
    expect(addHabit([habit("Read")], " read ", TODAY)).toEqual({ ok: false, error: "You already track that habit." });
  });

  it("does not mutate the input", () => {
    const habits: Habit[] = [];
    addHabit(habits, "Walk", TODAY);
    expect(habits).toHaveLength(0);
  });
});

describe("toggleDay", () => {
  it("marks a day done, then undone", () => {
    const once = toggleDay([habit("Read")], "Read", TODAY);
    expect(once[0].done).toEqual([TODAY]);
    const twice = toggleDay(once, "Read", TODAY);
    expect(twice[0].done).toEqual([]);
  });

  it("only touches the matching habit", () => {
    const result = toggleDay([habit("Read"), habit("Walk")], "Walk", TODAY);
    expect(result[0].done).toEqual([]);
    expect(result[1].done).toEqual([TODAY]);
  });
});

describe("deleteHabit", () => {
  it("removes the habit by id", () => {
    expect(deleteHabit([habit("Read"), habit("Walk")], "Read").map((h) => h.name)).toEqual(["Walk"]);
  });
});

describe("persistence", () => {
  it("round-trips habits", () => {
    const storage = memoryStore();
    const habits = [habit("Read", [TODAY])];
    saveHabits(storage, habits);
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
