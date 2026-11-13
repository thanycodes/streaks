import { formatSyncCode, generateSyncCode, normalizeSyncCode } from "./syncCode";

describe("generateSyncCode", () => {
  it("makes a 20-character code from the unambiguous alphabet", () => {
    const code = generateSyncCode();
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{20}$/);
  });

  it("is different every time", () => {
    expect(generateSyncCode()).not.toBe(generateSyncCode());
  });

  it("uses the random bytes it's given", () => {
    expect(generateSyncCode(() => new Uint8Array(20))).toBe("0".repeat(20));
  });
});

describe("normalizeSyncCode", () => {
  it("accepts the displayed form with dashes, spaces and lower case", () => {
    expect(normalizeSyncCode(" abcde-fghjk mnpqr-stvwx ")).toBe("ABCDEFGHJKMNPQRSTVWX");
  });

  it("forgives letters that look like digits", () => {
    expect(normalizeSyncCode("OOOOO-IIIII-LLLLL-00000")).toBe("00000111111111100000");
  });

  it("rejects codes that are too short or use other characters", () => {
    expect(normalizeSyncCode("ABCDE")).toBeNull();
    expect(normalizeSyncCode("UUUUU-UUUUU-UUUUU-UUUUU")).toBeNull();
    expect(normalizeSyncCode("")).toBeNull();
  });
});

it("formatSyncCode groups the code in fives for reading aloud", () => {
  expect(formatSyncCode("ABCDEFGHJKMNPQRSTVWX")).toBe("ABCDE-FGHJK-MNPQR-STVWX");
});
