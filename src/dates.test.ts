import { addDays, lastNDays, toDateKey } from "./dates";

describe("toDateKey", () => {
  it("formats the local calendar date with zero padding", () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("uses local time, not UTC, late in the evening", () => {
    expect(toDateKey(new Date(2026, 10, 11, 23, 59))).toBe("2026-11-11");
  });
});

describe("addDays", () => {
  it("moves forward and backward", () => {
    expect(addDays("2026-11-11", 1)).toBe("2026-11-12");
    expect(addDays("2026-11-11", -1)).toBe("2026-11-10");
  });

  it("crosses month and year boundaries", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("handles leap years", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
  });
});

describe("lastNDays", () => {
  it("returns n days oldest-first, ending today", () => {
    expect(lastNDays("2026-11-11", 3)).toEqual(["2026-11-09", "2026-11-10", "2026-11-11"]);
  });
});
