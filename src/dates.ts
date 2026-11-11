/** A local calendar date as `YYYY-MM-DD`. */
export type DateKey = string;

const pad = (n: number) => String(n).padStart(2, "0");

export function toDateKey(date: Date): DateKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function fromDateKey(key: DateKey): Date {
  const [y, m, d] = key.split("-").map(Number);
  // Noon avoids DST transitions pushing the date into the neighbouring day.
  return new Date(y, m - 1, d, 12);
}

export function addDays(key: DateKey, n: number): DateKey {
  const date = fromDateKey(key);
  date.setDate(date.getDate() + n);
  return toDateKey(date);
}

/** The last `n` days ending at `today`, oldest first. */
export function lastNDays(today: DateKey, n: number): DateKey[] {
  return Array.from({ length: n }, (_, i) => addDays(today, i - (n - 1)));
}
