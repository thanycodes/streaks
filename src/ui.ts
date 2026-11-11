import { lastNDays, type DateKey } from "./dates";
import { addHabit, deleteHabit, loadHabits, saveHabits, toggleDay, type Habit, type KeyValueStore } from "./store";
import { currentStreak, longestStreak } from "./streaks";

export interface AppOptions {
  storage: KeyValueStore;
  /** Injected so tests (and the midnight rollover) control what "today" is. */
  today: () => DateKey;
}

const WEEKDAY = new Intl.DateTimeFormat(undefined, { weekday: "narrow" });
const LONG_DATE = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric" });

function keyToDate(key: DateKey): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & { dataset?: Record<string, string> } = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const { dataset, ...rest } = props;
  const node = Object.assign(document.createElement(tag), rest);
  if (dataset) Object.assign(node.dataset, dataset);
  node.append(...children);
  return node;
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function renderHabit(habit: Habit, today: DateKey): HTMLElement {
  const current = currentStreak(habit.done, today);
  const best = longestStreak(habit.done);
  const doneToday = habit.done.includes(today);

  const check = el("button", {
    className: "check",
    textContent: doneToday ? "✓" : "",
    title: doneToday ? "Undo today" : "Mark done today",
    dataset: { action: "toggle", id: habit.id, day: today, focus: `check-${habit.id}` },
  });
  check.setAttribute("aria-pressed", String(doneToday));
  check.setAttribute("aria-label", `${habit.name}: done today`);

  const dots = lastNDays(today, 7).map((day) => {
    const done = habit.done.includes(day);
    const date = keyToDate(day);
    const dot = el(
      "button",
      {
        className: `dot${done ? " done" : ""}${day === today ? " today" : ""}`,
        title: LONG_DATE.format(date),
        dataset: { action: "toggle", id: habit.id, day, focus: `dot-${habit.id}-${day}` },
      },
      el("span", { className: "weekday", textContent: WEEKDAY.format(date) }),
    );
    dot.setAttribute("aria-pressed", String(done));
    dot.setAttribute("aria-label", `${habit.name}, ${LONG_DATE.format(date)}`);
    return dot;
  });

  const remove = el("button", {
    className: "delete",
    textContent: "×",
    title: "Delete habit",
    dataset: { action: "delete", id: habit.id },
  });
  remove.setAttribute("aria-label", `Delete ${habit.name}`);

  return el(
    "li",
    { className: `habit${doneToday ? " is-done" : ""}` },
    check,
    el(
      "div",
      { className: "body" },
      el("div", { className: "name", textContent: habit.name }),
      el(
        "div",
        { className: "stats" },
        el("span", { className: `streak${current > 0 ? " hot" : ""}`, textContent: `🔥 ${plural(current, "day")}` }),
        el("span", { className: "best", textContent: `Best ${best}` }),
      ),
    ),
    el("div", { className: "week", role: "group", ariaLabel: "Last 7 days" }, ...dots),
    remove,
  );
}

export function createApp(root: HTMLElement, { storage, today }: AppOptions) {
  let habits = loadHabits(storage);
  let error = "";

  const input = el("input", {
    id: "new-habit",
    placeholder: "Add a habit, e.g. Read 20 minutes",
    autocomplete: "off",
    maxLength: 60,
  });
  input.setAttribute("aria-label", "New habit name");
  const form = el("form", { className: "add" }, input, el("button", { type: "submit", textContent: "Add" }));
  const errorLine = el("p", { className: "error", role: "alert" });
  const list = el("ul", { className: "habits" });
  const summary = el("p", { className: "summary" });

  root.replaceChildren(
    el("header", {}, el("h1", { textContent: "Streaks" }), summary),
    form,
    errorLine,
    list,
  );

  function update(next: Habit[]) {
    habits = next;
    saveHabits(storage, habits);
    render();
  }

  function render() {
    const day = today();
    const focusKey = (document.activeElement as HTMLElement | null)?.dataset?.focus;

    const doneCount = habits.filter((h) => h.done.includes(day)).length;
    summary.textContent = habits.length
      ? `${LONG_DATE.format(keyToDate(day))} · ${doneCount}/${habits.length} done today`
      : LONG_DATE.format(keyToDate(day));
    errorLine.textContent = error;

    list.replaceChildren(
      ...(habits.length
        ? habits.map((h) => renderHabit(h, day))
        : [el("li", { className: "empty", textContent: "No habits yet. Add one above to start a streak." })]),
    );

    if (focusKey) list.querySelector<HTMLElement>(`[data-focus="${focusKey}"]`)?.focus();
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const result = addHabit(habits, input.value, today());
    if (result.ok) {
      error = "";
      input.value = "";
      update(result.habits);
    } else {
      error = result.error;
      render();
    }
  });

  input.addEventListener("input", () => {
    if (error) {
      error = "";
      render();
    }
  });

  list.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-action]");
    if (!button) return;
    const { action, id, day } = button.dataset;
    if (!id) return;
    if (action === "toggle" && day) update(toggleDay(habits, id, day));
    if (action === "delete") {
      const habit = habits.find((h) => h.id === id);
      if (habit && confirm(`Delete "${habit.name}" and its history?`)) update(deleteHabit(habits, id));
    }
  });

  render();
  return { render };
}
