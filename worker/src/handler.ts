import { merge } from "../../src/merge";
import { parseHabits, type Habit } from "../../src/store";
import { normalizeSyncCode } from "../../src/syncCode";

/** The two Workers KV calls we use, so tests can pass an in-memory fake. */
export interface KV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

/** Years of daily habits fit in a fraction of this; anything bigger is a mistake or abuse. */
export const MAX_BODY_BYTES = 512 * 1024;

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-max-age": "86400",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });
}

function error(status: number, message: string): Response {
  return json({ error: message }, status);
}

/** The server only ever sees a hash, so a leaked KV dump can't be used to sync. */
async function storageKey(code: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `habits:${hex}`;
}

function readCode(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? normalizeSyncCode(match[1]) : null;
}

async function readStored(kv: KV, key: string): Promise<Habit[]> {
  const raw = await kv.get(key);
  if (raw === null) return [];
  try {
    // If this were ever corrupt, the device's own copy (merged below) still holds its data.
    return parseHabits(JSON.parse(raw)) ?? [];
  } catch {
    return [];
  }
}

async function readIncoming(request: Request): Promise<Habit[] | Response> {
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return error(413, "Too much data.");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return error(400, "Body must be JSON.");
  }
  const habits = parseHabits((body as { habits?: unknown } | null)?.habits);
  return habits ?? error(400, "Habit data is malformed.");
}

async function handleSync(request: Request, kv: KV): Promise<Response> {
  const code = readCode(request);
  if (!code) return error(401, "Missing or invalid sync code.");
  const incoming = await readIncoming(request);
  if (incoming instanceof Response) return incoming;

  const key = await storageKey(code);
  const merged = merge(await readStored(kv, key), incoming);
  await kv.put(key, JSON.stringify(merged));
  return json({ habits: merged });
}

export async function handle(request: Request, kv: KV): Promise<Response> {
  const { pathname } = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (pathname === "/") return json({ ok: true, service: "streaks-sync" });
  if (pathname !== "/sync") return error(404, "Not found.");
  if (request.method !== "POST") return error(405, "Use POST.");
  return handleSync(request, kv);
}
