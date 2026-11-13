// @vitest-environment jsdom
import { createSyncPanel, type SyncControls } from "./syncPanel";
import type { SyncStatus } from "./sync";

function fakeSync(available = true) {
  let code: string | null = null;
  let status: SyncStatus = "off";
  const controls: SyncControls & { setStatus(s: SyncStatus): void } = {
    state: () => ({ status: code ? status : "off", code, available }),
    turnOn: () => (code = "ABCDEFGHJKMNPQRSTVWX"),
    join: (input) => (input === "good" ? ((code = "00000000000000000000"), null) : "That doesn't look like a sync code."),
    turnOff: () => void (code = null),
    syncNow: async () => {},
    setStatus: (s) => void (status = s),
  };
  return controls;
}

function setup(available = true) {
  const root = document.createElement("section");
  document.body.replaceChildren(root);
  const sync = fakeSync(available);
  const panel = createSyncPanel(root, sync);
  const click = (text: string) =>
    [...root.querySelectorAll("button")].find((b) => b.textContent === text)!.click();
  return { root, sync, panel, click };
}

it("explains when the build has no sync server", () => {
  expect(setup(false).root.textContent).toContain("Sync isn't set up");
});

it("turning sync on shows the code in readable groups", () => {
  const { root, click } = setup();
  click("Turn on sync");
  expect(root.querySelector(".sync-code")?.textContent).toBe("ABCDE-FGHJK-MNPQR-STVWX");
});

it("joining with a bad code shows the error", () => {
  const { root } = setup();
  root.querySelector<HTMLInputElement>("#sync-code")!.value = "bad";
  root.querySelector("form")!.dispatchEvent(new Event("submit", { cancelable: true }));
  expect(root.querySelector(".error")?.textContent).toContain("doesn't look like");
});

it("joining with a good code switches to the code view", () => {
  const { root } = setup();
  root.querySelector<HTMLInputElement>("#sync-code")!.value = "good";
  root.querySelector("form")!.dispatchEvent(new Event("submit", { cancelable: true }));
  expect(root.querySelector(".sync-code")?.textContent).toBe("00000-00000-00000-00000");
});

it("announces status changes in a live region", () => {
  const { root, sync, panel, click } = setup();
  click("Turn on sync");
  sync.setStatus("offline");
  panel.renderStatus();
  const status = root.querySelector('[role="status"]');
  expect(status?.textContent).toContain("Offline");
});

it("turning sync off goes back to the start", () => {
  const { root, click } = setup();
  click("Turn on sync");
  click("Turn off sync");
  expect(root.textContent).toContain("Turn on sync");
});
