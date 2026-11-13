import { merge } from "./merge";
import { deleteHabit, doneDays, toggleDay, visibleHabits, type DayMark, type Habit } from "./store";

const D1 = "2026-11-10";
const D2 = "2026-11-11";

function habit(id: string, days: Record<string, DayMark> = {}, extra: Partial<Habit> = {}): Habit {
  return { id, name: id, createdAt: D1, addedAt: 1, days, ...extra };
}

const byId = (habits: Habit[], id: string) => habits.find((h) => h.id === id)!;

describe("merge", () => {
  it("keeps habits that only one side has", () => {
    const result = merge([habit("a")], [habit("b")]);
    expect(result.map((h) => h.id).sort()).toEqual(["a", "b"]);
  });

  it("takes the newest change for each day", () => {
    const phone = habit("a", { [D1]: { done: true, at: 10 }, [D2]: { done: true, at: 10 } });
    const mac = habit("a", { [D1]: { done: false, at: 20 }, [D2]: { done: false, at: 5 } });
    const result = byId(merge([phone], [mac]), "a");
    expect(result.days[D1]).toEqual({ done: false, at: 20 });
    expect(result.days[D2]).toEqual({ done: true, at: 10 });
  });

  it("breaks exact ties the same way on every device (done wins)", () => {
    const a = habit("a", { [D1]: { done: false, at: 10 } });
    const b = habit("a", { [D1]: { done: true, at: 10 } });
    expect(byId(merge([a], [b]), "a").days[D1].done).toBe(true);
    expect(byId(merge([b], [a]), "a").days[D1].done).toBe(true);
  });

  it("lets a delete win, so deleted habits don't come back", () => {
    const deleted = habit("a", {}, { deleted: true });
    const edited = habit("a", { [D1]: { done: true, at: 99 } });
    expect(byId(merge([edited], [deleted]), "a").deleted).toBe(true);
    expect(visibleHabits(merge([deleted], [edited]))).toEqual([]);
  });

  it("keeps the earliest addedAt and createdAt", () => {
    const a = habit("a", {}, { addedAt: 5, createdAt: "2026-11-05" });
    const b = habit("a", {}, { addedAt: 3, createdAt: "2026-11-07" });
    expect(byId(merge([a], [b]), "a")).toMatchObject({ addedAt: 3, createdAt: "2026-11-05" });
  });

  it("does not mutate its inputs", () => {
    const a = [habit("a", { [D1]: { done: true, at: 1 } })];
    const before = structuredClone(a);
    merge(a, [habit("a", { [D1]: { done: false, at: 2 } })]);
    expect(a).toEqual(before);
  });
});

describe("same-named habits from two devices", () => {
  // Both devices added "Read" while offline, so there are two habits with different ids.
  const phone = habit("p", { [D1]: { done: true, at: 10 } }, { name: "Read", addedAt: 1 });
  const mac = habit("m", { [D2]: { done: true, at: 11 } }, { name: "read", addedAt: 2 });
  const merged = merge([phone], [mac]);

  it("show as one habit with the days from both", () => {
    const shown = visibleHabits(merged);
    expect(shown).toHaveLength(1);
    expect(shown[0]).toMatchObject({ id: "p", name: "Read" });
    expect(doneDays(shown[0])).toEqual([D1, D2]);
  });

  it("can be un-checked even when the check came from the other copy", () => {
    const after = toggleDay(merged, "p", D2, 20);
    expect(doneDays(visibleHabits(after)[0])).toEqual([D1]);
  });

  it("pick up later changes made to either copy", () => {
    const macLater = toggleDay([mac], "m", "2026-11-12", 50);
    expect(doneDays(visibleHabits(merge(merged, macLater))[0])).toEqual([D1, D2, "2026-11-12"]);
  });

  it("are deleted together", () => {
    expect(visibleHabits(deleteHabit(merged, "p"))).toEqual([]);
  });
});

describe("merge laws (randomized)", () => {
  // Small seeded PRNG so a failure is reproducible.
  function rng(seed: number) {
    return () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
  }

  function randomHabits(next: () => number): Habit[] {
    const ids = ["a", "b", "c", "d"];
    const names = ["Read", "read", "Walk", "Swim"];
    const days = ["2026-11-01", "2026-11-02", "2026-11-03"];
    return ids
      .filter(() => next() < 0.7)
      .map((id) => {
        const marks: Record<string, DayMark> = {};
        for (const day of days) if (next() < 0.5) marks[day] = { done: next() < 0.5, at: Math.floor(next() * 4) };
        const h = habit(id, marks, { name: names[Math.floor(next() * names.length)], addedAt: Math.floor(next() * 3) });
        if (next() < 0.15) h.deleted = true;
        return h;
      });
  }

  // Real devices only ever disagree on days and deletes, never on a habit's name.
  function consistentNames(sets: Habit[][]): Habit[][] {
    const names = new Map<string, string>();
    return sets.map((set) =>
      set.map((h) => {
        if (!names.has(h.id)) names.set(h.id, h.name);
        return { ...h, name: names.get(h.id)! };
      }),
    );
  }

  it("is commutative, associative and idempotent", () => {
    const next = rng(42);
    for (let i = 0; i < 500; i++) {
      const [a, b, c] = consistentNames([randomHabits(next), randomHabits(next), randomHabits(next)]);
      expect(merge(a, b)).toEqual(merge(b, a));
      expect(merge(merge(a, b), c)).toEqual(merge(a, merge(b, c)));
      const ab = merge(a, b);
      expect(merge(ab, ab)).toEqual(ab);
      expect(merge(ab, a)).toEqual(ab);
    }
  });
});
