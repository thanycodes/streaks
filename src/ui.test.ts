// @vitest-environment jsdom
import { createApp } from "./ui";
import type { KeyValueStore } from "./store";

function memoryStore(): KeyValueStore {
  const data: Record<string, string> = {};
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}

function setup() {
  const root = document.createElement("main");
  document.body.replaceChildren(root);
  const storage = memoryStore();
  createApp(root, { storage, today: () => "2026-11-11" });
  const add = (name: string) => {
    root.querySelector<HTMLInputElement>("#new-habit")!.value = name;
    root.querySelector("form")!.dispatchEvent(new Event("submit", { cancelable: true }));
  };
  return { root, storage, add };
}

it("shows an empty state", () => {
  expect(setup().root.textContent).toContain("No habits yet");
});

it("adds a habit and checks it off for today", () => {
  const { root, add } = setup();
  add("Stretch");
  expect(root.querySelector(".name")?.textContent).toBe("Stretch");
  expect(root.querySelector(".streak")?.textContent).toContain("0 days");

  root.querySelector<HTMLButtonElement>(".check")!.click();
  expect(root.querySelector(".check")?.getAttribute("aria-pressed")).toBe("true");
  expect(root.querySelector(".streak")?.textContent).toContain("1 day");
  expect(root.querySelector(".summary")?.textContent).toContain("1/1 done today");
});

it("shows a validation error for duplicates", () => {
  const { root, add } = setup();
  add("Stretch");
  add("stretch");
  expect(root.querySelector(".error")?.textContent).toBe("You already track that habit.");
  expect(root.querySelectorAll(".habit")).toHaveLength(1);
});

it("persists to storage and survives a reload", () => {
  const { root, storage, add } = setup();
  add("Read");
  root.querySelector<HTMLButtonElement>(".check")!.click();

  const reloaded = document.createElement("main");
  createApp(reloaded, { storage, today: () => "2026-11-11" });
  expect(reloaded.querySelector(".name")?.textContent).toBe("Read");
  expect(reloaded.querySelector(".check")?.getAttribute("aria-pressed")).toBe("true");
});

it("renders 7 day dots with today last", () => {
  const { root, add } = setup();
  add("Walk");
  const dots = root.querySelectorAll<HTMLButtonElement>(".dot");
  expect(dots).toHaveLength(7);
  expect(dots[6].dataset.day).toBe("2026-11-11");
  expect(dots[0].dataset.day).toBe("2026-11-05");
});

describe("deleting", () => {
  it("asks for a second click instead of a browser dialog", () => {
    const { root, add } = setup();
    add("Walk");
    const remove = () => root.querySelector<HTMLButtonElement>(".delete")!;
    remove().click();
    expect(root.querySelectorAll(".habit")).toHaveLength(1);
    expect(remove().getAttribute("aria-label")).toBe("Confirm: delete Walk and its history");
    remove().click();
    expect(root.querySelectorAll(".habit")).toHaveLength(0);
  });

  it("cancels the pending delete with Escape", () => {
    const { root, add } = setup();
    add("Walk");
    root.querySelector<HTMLButtonElement>(".delete")!.click();
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(root.querySelector(".delete")?.getAttribute("aria-label")).toBe("Delete Walk");
  });

  it("cancels the pending delete when something else is clicked", () => {
    const { root, add } = setup();
    add("Walk");
    root.querySelector<HTMLButtonElement>(".delete")!.click();
    root.querySelector<HTMLButtonElement>(".check")!.click();
    expect(root.querySelector(".delete")?.getAttribute("aria-label")).toBe("Delete Walk");
  });
});

describe("screen reader labels", () => {
  it("say the habit, the day and whether it's done", () => {
    const { root, add } = setup();
    add("Stretch");
    const check = () => root.querySelector(".check")!;
    expect(check().getAttribute("aria-label")).toBe("Stretch: not done today");
    root.querySelector<HTMLButtonElement>(".check")!.click();
    expect(check().getAttribute("aria-label")).toBe("Stretch: done today");
    const lastDot = [...root.querySelectorAll(".dot")].at(-1)!;
    expect(lastDot.getAttribute("aria-label")).toMatch(/^Stretch, .+: done$/);
  });

  it("read streaks as words, not emoji", () => {
    const { root, add } = setup();
    add("Stretch");
    const streak = root.querySelector(".streak")!;
    expect(streak.querySelector('[aria-hidden="true"]')?.textContent).toContain("🔥");
    expect(streak.querySelector(".sr-only")?.textContent).toBe("Current streak: ");
  });

  it("announce today's progress as it changes", () => {
    const { root } = setup();
    expect(root.querySelector(".summary")?.getAttribute("role")).toBe("status");
  });

  it("name each 7-day row after its habit", () => {
    const { root, add } = setup();
    add("Walk");
    expect(root.querySelector(".week")?.getAttribute("aria-label")).toBe("Walk, last 7 days");
  });
});
