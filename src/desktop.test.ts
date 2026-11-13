// @vitest-environment jsdom
import { createDesktopSettings, isDesktop } from "./desktop";

function setup(initial: boolean, failSet = false) {
  const calls: boolean[] = [];
  const root = document.createElement("section");
  document.body.replaceChildren(root);
  const { ready } = createDesktopSettings(root, {
    autostartEnabled: async () => initial,
    setAutostart: async (enabled) => {
      if (failSet) throw new Error("denied");
      calls.push(enabled);
    },
  });
  const box = root.querySelector<HTMLInputElement>("#autostart")!;
  return { root, box, calls, ready };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

it("is not a desktop app in a plain browser", () => {
  expect(isDesktop()).toBe(false);
});

it("shows the current login setting (off by default)", async () => {
  const { box, ready } = setup(false);
  await ready;
  expect(box.checked).toBe(false);
  expect(box.disabled).toBe(false);
});

it("turns start-at-login on when ticked", async () => {
  const { box, calls, ready } = setup(false);
  await ready;
  box.click();
  await flush();
  expect(calls).toEqual([true]);
});

it("puts the switch back and says so if the change fails", async () => {
  const { root, box, ready } = setup(false, true);
  await ready;
  box.click();
  await flush();
  expect(box.checked).toBe(false);
  expect(root.querySelector(".error")?.textContent).toContain("Couldn't change");
});

it("mentions the keyboard shortcut", () => {
  expect(setup(false).root.textContent).toContain("⌃⌥S");
});
