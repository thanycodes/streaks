import { addDays, type DateKey } from "./dates";

export function currentStreak(dates: readonly DateKey[], today: DateKey): number {
  const done = new Set(dates);
  // Today still counts as "in progress", so a streak through yesterday stays alive.
  let day = done.has(today) ? today : addDays(today, -1);
  let count = 0;
  while (done.has(day)) {
    count++;
    day = addDays(day, -1);
  }
  return count;
}

export function longestStreak(dates: readonly DateKey[]): number {
  const sorted = [...new Set(dates)].sort();
  let best = 0;
  let run = 0;
  sorted.forEach((day, i) => {
    run = i > 0 && addDays(sorted[i - 1], 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}
