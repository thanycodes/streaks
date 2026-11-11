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

it("deletes after confirmation", () => {
  const { root, add } = setup();
  add("Walk");
  globalThis.confirm = () => true;
  root.querySelector<HTMLButtonElement>(".delete")!.click();
  expect(root.querySelectorAll(".habit")).toHaveLength(0);
});
