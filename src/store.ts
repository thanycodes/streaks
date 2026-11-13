import type { DateKey } from "./dates";

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
  /** Set when a merge folded this habit into a same-named one. */
  mergedInto?: string;
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

export function isVisible(habit: Habit): boolean {
  return !habit.deleted && habit.mergedInto === undefined;
}

export function compareByAdded(a: Habit, b: Habit): number {
  return a.addedAt - b.addedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

export function visibleHabits(habits: readonly Habit[]): Habit[] {
  return habits.filter(isVisible).sort(compareByAdded);
}

export function doneDays(habit: Habit): DateKey[] {
  return Object.keys(habit.days).filter((day) => habit.days[day].done).sort();
}

export function sameName(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

export function addHabit(habits: readonly Habit[], rawName: string, today: DateKey, now: number): AddResult {
  const name = rawName.trim();
  if (!name) return { ok: false, error: "Name can't be empty." };
  if (habits.some((h) => isVisible(h) && sameName(h.name, name))) {
    return { ok: false, error: "You already track that habit." };
  }
  const habit: Habit = { id: makeId(), name, createdAt: today, addedAt: now, days: {} };
  return { ok: true, habits: [...habits, habit] };
}

export function toggleDay(habits: readonly Habit[], id: string, day: DateKey, now: number): Habit[] {
  return habits.map((h) => {
    if (h.id !== id) return h;
    const previous = h.days[day];
    // A local change must beat the one it replaces, even if this device's clock jumped back.
    const at = previous && previous.at >= now ? previous.at + 1 : now;
    return { ...h, days: { ...h.days, [day]: { done: !previous?.done, at } } };
  });
}

export function deleteHabit(habits: readonly Habit[], id: string): Habit[] {
  return habits.map((h) => (h.id === id ? { ...h, deleted: true } : h));
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
    (h.deleted === undefined || h.deleted === true) &&
    (h.mergedInto === undefined || typeof h.mergedInto === "string")
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
