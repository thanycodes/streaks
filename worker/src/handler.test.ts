import { handle, MAX_BODY_BYTES, type KV } from "./handler";
import type { Habit } from "../../src/store";

const CODE = "ABCDEFGHJKMNPQRSTVWX";

function fakeKV(): KV & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get: async (key) => data.get(key) ?? null,
    put: async (key, value) => void data.set(key, value),
  };
}

function habit(id: string, day: string, at: number, done = true): Habit {
  return { id, name: id, createdAt: day, addedAt: 1, days: { [day]: { done, at } } };
}

function sync(kv: KV, habits: unknown, code: string | null = CODE) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (code !== null) headers.authorization = `Bearer ${code}`;
  return handle(new Request("https://sync.test/sync", { method: "POST", headers, body: JSON.stringify({ habits }) }), kv);
}

async function habitsOf(response: Response): Promise<Habit[]> {
  return ((await response.json()) as { habits: Habit[] }).habits;
}

describe("POST /sync", () => {
  it("stores the first upload and returns it", async () => {
    const kv = fakeKV();
    const response = await sync(kv, [habit("read", "2026-11-11", 5)]);
    expect(response.status).toBe(200);
    expect(await habitsOf(response)).toEqual([habit("read", "2026-11-11", 5)]);
  });

  it("merges a second device's data with what's stored", async () => {
    const kv = fakeKV();
    await sync(kv, [habit("read", "2026-11-11", 5)]);
    const habits = await habitsOf(await sync(kv, [habit("read", "2026-11-11", 9, false), habit("walk", "2026-11-11", 3)]));
    expect(habits.map((h) => h.id)).toEqual(["read", "walk"]);
    expect(habits[0].days["2026-11-11"]).toEqual({ done: false, at: 9 });
  });

  it("keeps different codes apart", async () => {
    const kv = fakeKV();
    await sync(kv, [habit("read", "2026-11-11", 5)]);
    expect(await habitsOf(await sync(kv, [], "00000000000000000000"))).toEqual([]);
  });

  it("stores data under a hash of the code, never the code itself", async () => {
    const kv = fakeKV();
    await sync(kv, [habit("read", "2026-11-11", 5)]);
    const [key] = [...kv.data.keys()];
    expect(key).toMatch(/^habits:[0-9a-f]{64}$/);
    expect(key).not.toContain(CODE);
  });

  it("accepts the code in its displayed form", async () => {
    const kv = fakeKV();
    await sync(kv, [habit("read", "2026-11-11", 5)]);
    expect(await habitsOf(await sync(kv, [], "abcde-fghjk-mnpqr-stvwx"))).toHaveLength(1);
  });

  it("rejects a missing or malformed code", async () => {
    expect((await sync(fakeKV(), [], null)).status).toBe(401);
    expect((await sync(fakeKV(), [], "short")).status).toBe(401);
  });

  it("rejects malformed habit data without touching what's stored", async () => {
    const kv = fakeKV();
    await sync(kv, [habit("read", "2026-11-11", 5)]);
    const before = [...kv.data.values()];
    expect((await sync(kv, [{ id: 1 }])).status).toBe(400);
    expect([...kv.data.values()]).toEqual(before);
  });

  it("rejects bodies that aren't JSON", async () => {
    const request = new Request("https://sync.test/sync", {
      method: "POST",
      headers: { authorization: `Bearer ${CODE}` },
      body: "{nope",
    });
    expect((await handle(request, fakeKV())).status).toBe(400);
  });

  it("rejects oversized bodies", async () => {
    const huge = [{ ...habit("read", "2026-11-11", 5), name: "x".repeat(MAX_BODY_BYTES) }];
    expect((await sync(fakeKV(), huge)).status).toBe(413);
  });

  it("recovers if stored data is somehow corrupt, keeping the device's copy", async () => {
    const kv = fakeKV();
    await sync(kv, []);
    const [key] = [...kv.data.keys()];
    kv.data.set(key, "{corrupt");
    expect(await habitsOf(await sync(kv, [habit("read", "2026-11-11", 5)]))).toHaveLength(1);
  });
});

describe("other requests", () => {
  it("answers CORS preflight so the web and Mac apps can call it", async () => {
    const response = await handle(new Request("https://sync.test/sync", { method: "OPTIONS" }), fakeKV());
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("access-control-allow-headers")).toContain("authorization");
  });

  it("adds CORS headers to normal responses too", async () => {
    expect((await sync(fakeKV(), [])).headers.get("access-control-allow-origin")).toBe("*");
  });

  it("has a health check at /", async () => {
    const response = await handle(new Request("https://sync.test/"), fakeKV());
    expect(response.status).toBe(200);
  });

  it("returns 404 for anything else", async () => {
    expect((await handle(new Request("https://sync.test/nope"), fakeKV())).status).toBe(404);
    expect((await handle(new Request("https://sync.test/sync"), fakeKV())).status).toBe(405);
  });
});
