import { currentStreak, longestStreak } from "./streaks";

const TODAY = "2026-11-11";

describe("currentStreak", () => {
  it("is 0 with no history", () => {
    expect(currentStreak([], TODAY)).toBe(0);
  });

  it("counts consecutive days ending today", () => {
    expect(currentStreak(["2026-11-09", "2026-11-10", "2026-11-11"], TODAY)).toBe(3);
  });

  it("is not broken just because today isn't done yet", () => {
    expect(currentStreak(["2026-11-09", "2026-11-10"], TODAY)).toBe(2);
  });

  it("is 0 when neither today nor yesterday is done", () => {
    expect(currentStreak(["2026-11-08", "2026-11-09"], TODAY)).toBe(0);
  });

  it("stops at the first gap", () => {
    expect(currentStreak(["2026-11-07", "2026-11-09", "2026-11-10", "2026-11-11"], TODAY)).toBe(3);
  });

  it("ignores order and duplicates", () => {
    expect(currentStreak(["2026-11-11", "2026-11-10", "2026-11-11"], TODAY)).toBe(2);
  });

  it("works across a month boundary", () => {
    expect(currentStreak(["2026-10-31", "2026-11-01"], "2026-11-01")).toBe(2);
  });
});

describe("longestStreak", () => {
  it("is 0 with no history", () => {
    expect(longestStreak([])).toBe(0);
  });

  it("is 1 for a single day", () => {
    expect(longestStreak(["2026-11-11"])).toBe(1);
  });

  it("finds the longest run, not the latest", () => {
    const dates = ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-09", "2026-11-10"];
    expect(longestStreak(dates)).toBe(4);
  });

  it("handles unsorted input with duplicates", () => {
    expect(longestStreak(["2026-11-03", "2026-11-01", "2026-11-02", "2026-11-02"])).toBe(3);
  });

  it("handles runs across a year boundary", () => {
    expect(longestStreak(["2025-12-30", "2025-12-31", "2026-01-01"])).toBe(3);
  });
});
