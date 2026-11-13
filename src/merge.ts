import type { DateKey } from "./dates";
import type { DayMark, Habit } from "./store";

/** Newest change wins. Exact ties go to "done" so every device picks the same mark. */
export function newer(a: DayMark, b: DayMark): DayMark {
  if (a.at !== b.at) return a.at > b.at ? a : b;
  return a.done ? a : b;
}

export function mergeDays(a: Habit["days"], b: Habit["days"]): Habit["days"] {
  const days: Record<DateKey, DayMark> = {};
  for (const day of new Set([...Object.keys(a), ...Object.keys(b)].sort())) {
    const left = a[day];
    const right = b[day];
    days[day] = left && right ? newer(left, right) : (left ?? right);
  }
  return days;
}

function smaller(a: string, b: string): string {
  return a < b ? a : b;
}

/** Two copies of the same habit (same id). A delete is one-way, so either side's delete wins. */
function mergeHabit(a: Habit, b: Habit): Habit {
  const habit: Habit = {
    id: a.id,
    name: smaller(a.name, b.name),
    createdAt: smaller(a.createdAt, b.createdAt),
    addedAt: Math.min(a.addedAt, b.addedAt),
    days: mergeDays(a.days, b.days),
  };
  if (a.deleted || b.deleted) habit.deleted = true;
  return habit;
}

/**
 * Combines two copies of the data. Safe to repeat and to apply in any order.
 * Same-named habits are *not* collapsed here (that would depend on arrival order);
 * `visibleHabits` shows them as one.
 */
export function merge(a: readonly Habit[], b: readonly Habit[]): Habit[] {
  const byId = new Map<string, Habit>();
  for (const habit of [...a, ...b]) {
    const existing = byId.get(habit.id);
    byId.set(habit.id, existing ? mergeHabit(existing, habit) : habit);
  }
  return [...byId.values()].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
}
