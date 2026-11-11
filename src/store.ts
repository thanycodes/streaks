import type { DateKey } from "./dates";

export interface Habit {
  id: string;
  name: string;
  createdAt: DateKey;
  done: DateKey[];
}

export type AddResult = { ok: true; habits: Habit[] } | { ok: false; error: string };

/** The subset of `localStorage` we rely on, so tests can pass a fake. */
export type KeyValueStore = Pick<Storage, "getItem" | "setItem">;

export const STORAGE_KEY = "streaks:v1";

export function addHabit(habits: readonly Habit[], rawName: string, today: DateKey): AddResult {
  const name = rawName.trim();
  if (!name) return { ok: false, error: "Name can't be empty." };
  if (habits.some((h) => h.name.toLowerCase() === name.toLowerCase())) {
    return { ok: false, error: "You already track that habit." };
  }
  const habit: Habit = { id: crypto.randomUUID(), name, createdAt: today, done: [] };
  return { ok: true, habits: [...habits, habit] };
}

export function toggleDay(habits: readonly Habit[], id: string, day: DateKey): Habit[] {
  return habits.map((h) => {
    if (h.id !== id) return h;
    const done = h.done.includes(day) ? h.done.filter((d) => d !== day) : [...h.done, day].sort();
    return { ...h, done };
  });
}

export function deleteHabit(habits: readonly Habit[], id: string): Habit[] {
  return habits.filter((h) => h.id !== id);
}

function isHabit(value: unknown): value is Habit {
  const h = value as Habit;
  return (
    typeof h === "object" && h !== null &&
    typeof h.id === "string" && typeof h.name === "string" &&
    typeof h.createdAt === "string" &&
    Array.isArray(h.done) && h.done.every((d) => typeof d === "string")
  );
}

export function loadHabits(storage: KeyValueStore): Habit[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) && parsed.every(isHabit) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveHabits(storage: KeyValueStore, habits: readonly Habit[]): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(habits));
}
