import type { DateKey } from "./dates";
import { mergeDays, newer } from "./merge";

/** Whether a day was done, and the change time (epoch ms) that set it. */
export interface DayMark {
  done: boolean;
  at: number;
}

export interface Habit {
  id: string;
  name: string;
  createdAt: DateKey;
  /** Change time of the add; keeps list order stable across devices. */
  addedAt: number;
  days: Record<DateKey, DayMark>;
  /** Tombstone: kept (hidden) so the delete reaches other devices. */
  deleted?: true;
}

export type AddResult = { ok: true; habits: Habit[] } | { ok: false; error: string };

/** The subset of `localStorage` we rely on, so tests can pass a fake. */
export type KeyValueStore = Pick<Storage, "getItem" | "setItem">;

export const STORAGE_KEY = "streaks:v2";
export const LEGACY_KEY = "streaks:v1";

function makeId(): string {
  // randomUUID only exists in secure contexts; a phone on http://192.168.x.x isn't one.
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export function compareByAdded(a: Habit, b: Habit): number {
  return a.addedAt - b.addedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

export function sameName(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

function liveHabits(habits: readonly Habit[]): Habit[] {
  return habits.filter((h) => !h.deleted);
}

/** All live habits sharing this habit's name: two devices may each have added "Read" offline. */
function sameNamed(habits: readonly Habit[], habit: Habit): Habit[] {
  return liveHabits(habits).filter((h) => sameName(h.name, habit.name));
}

/**
 * What the user sees: tombstones hidden, and same-named habits shown as one habit
 * (the one added first) with the newest mark for each day across all copies.
 */
export function visibleHabits(habits: readonly Habit[]): Habit[] {
  const groups = new Map<string, Habit[]>();
  for (const habit of liveHabits(habits)) {
    const key = habit.name.toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), habit]);
  }
  return [...groups.values()]
    .map((group) => {
      const [first, ...rest] = [...group].sort(compareByAdded);
      return { ...first, days: rest.reduce((days, h) => mergeDays(days, h.days), first.days) };
    })
    .sort(compareByAdded);
}

export function doneDays(habit: Habit): DateKey[] {
  return Object.keys(habit.days).filter((day) => habit.days[day].done).sort();
}

export function addHabit(habits: readonly Habit[], rawName: string, today: DateKey, now: number): AddResult {
  const name = rawName.trim();
  if (!name) return { ok: false, error: "Name can't be empty." };
  if (liveHabits(habits).some((h) => sameName(h.name, name))) {
    return { ok: false, error: "You already track that habit." };
  }
  const habit: Habit = { id: makeId(), name, createdAt: today, addedAt: now, days: {} };
  return { ok: true, habits: [...habits, habit] };
}

export function toggleDay(habits: readonly Habit[], id: string, day: DateKey, now: number): Habit[] {
  const target = habits.find((h) => h.id === id);
  if (!target) return [...habits];
  const marks = sameNamed(habits, target).map((h) => h.days[day]).filter((m) => m !== undefined);
  const previous = marks.length ? marks.reduce(newer) : undefined;
  // A local change must beat the one it replaces, even if this device's clock jumped back.
  const at = previous && previous.at >= now ? previous.at + 1 : now;
  return habits.map((h) => (h.id === id ? { ...h, days: { ...h.days, [day]: { done: !previous?.done, at } } } : h));
}

/** Deletes the habit and any same-named copies, so the combined habit doesn't reappear. */
export function deleteHabit(habits: readonly Habit[], id: string): Habit[] {
  const target = habits.find((h) => h.id === id);
  if (!target) return [...habits];
  const doomed = new Set(sameNamed(habits, target).map((h) => h.id).concat(id));
  return habits.map((h) => (doomed.has(h.id) ? { ...h, deleted: true } : h));
}

function isDayMark(value: unknown): value is DayMark {
  const m = value as DayMark;
  return typeof m === "object" && m !== null && typeof m.done === "boolean" && typeof m.at === "number";
}

function isHabit(value: unknown): value is Habit {
  const h = value as Habit;
  return (
    typeof h === "object" && h !== null &&
    typeof h.id === "string" && typeof h.name === "string" &&
    typeof h.createdAt === "string" && typeof h.addedAt === "number" &&
    typeof h.days === "object" && h.days !== null && !Array.isArray(h.days) &&
    Object.values(h.days).every(isDayMark) &&
    (h.deleted === undefined || h.deleted === true)
  );
}

/** Validates untrusted data (storage, network). Returns null if anything is off. */
export function parseHabits(value: unknown): Habit[] | null {
  return Array.isArray(value) && value.every(isHabit) ? value : null;
}

interface LegacyHabit {
  id: string;
  name: string;
  createdAt: DateKey;
  done: DateKey[];
}

function isLegacyHabit(value: unknown): value is LegacyHabit {
  const h = value as LegacyHabit;
  return (
    typeof h === "object" && h !== null &&
    typeof h.id === "string" && typeof h.name === "string" && typeof h.createdAt === "string" &&
    Array.isArray(h.done) && h.done.every((d) => typeof d === "string")
  );
}

/** v1 had no change times. 0 marks them as older than any real change. */
function upgradeLegacy(legacy: LegacyHabit[]): Habit[] {
  return legacy.map((h, index) => ({
    id: h.id,
    name: h.name,
    createdAt: h.createdAt,
    addedAt: index,
    days: Object.fromEntries(h.done.map((day) => [day, { done: true, at: 0 }])),
  }));
}

function readJson(storage: KeyValueStore, key: string): unknown {
  const raw = storage.getItem(key);
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function loadHabits(storage: KeyValueStore): Habit[] {
  const current = readJson(storage, STORAGE_KEY);
  if (current !== undefined) return parseHabits(current) ?? [];
  const legacy = readJson(storage, LEGACY_KEY);
  if (Array.isArray(legacy) && legacy.every(isLegacyHabit)) return upgradeLegacy(legacy);
  return [];
}

export function saveHabits(storage: KeyValueStore, habits: readonly Habit[]): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(habits));
}
