import { createOverlay } from "./overlay.js";
import { bookmarkStore } from "./bookmark-store.js";
import { historyStore } from "./reading-history.js";
import { searchHistory } from "./search-history.js";
import { favoriteStore } from "./favorites.js";
import { downloadExport, applyImport, describeImport } from "./data-transfer.js";

/**
 * Your data: the panel behind the header's person.
 *
 * Everything the site is keeping for this reader, in one place — what there is
 * of it, how to take a copy, and how to destroy it. It used to be the bottom
 * third of the Reading panel, under four radio groups about typefaces, which
 * is neither where anyone would look for it nor company it belongs in.
 *
 * There is no account here and nothing to sign in to. The icon is a person
 * because that is what a reader reads as "my things", and the panel's first
 * line says where those things actually live.
 */

/**
 * The stores, in the order the panel talks about them.
 *
 * One list drives the summary, the clear buttons and the composite that clears
 * the lot, so a fifth store is one entry here rather than four edits.
 */
const STORES = [
  { key: "bookmarks", store: bookmarkStore, one: "bookmark", many: "bookmarks", clear: "[data-clear-bookmarks]", label: "Clear bookmarks" },
  { key: "favorites", store: favoriteStore, one: "favorite game", many: "favorite games", clear: "[data-clear-favorites]", label: "Clear favorites" },
  { key: "history", store: historyStore, one: "game visited", many: "games visited", clear: "[data-clear-history]", label: "Clear history" },
  { key: "searches", store: searchHistory, one: "saved search", many: "saved searches", clear: "[data-clear-searches]", label: "Clear searches" },
];

/**
 * A clear button that asks once.
 *
 * Erasing a reading history or a shelf of bookmarks cannot be undone, and a
 * mis-tap in a panel full of radio buttons is easy. The second press is the
 * confirmation — no native dialog, and it forgets the question on its own if
 * the reader does something else, which closing the panel counts as.
 *
 * `store` is anything with `list`, `clear` and `subscribe`, which is every
 * store here and also the composite one below that stands for all of them.
 */
function armClearButton(button, { label, store, confirm = "Sure?" }) {
  if (!button) return () => {};

  let armed = false;

  function reset() {
    armed = false;
    button.textContent = label;
    button.classList.remove("is-armed");
  }

  function refresh() {
    const empty = store.list().length === 0;
    button.disabled = empty;
    if (empty) reset();
  }

  button.addEventListener("click", () => {
    if (!armed) {
      armed = true;
      button.textContent = confirm;
      button.classList.add("is-armed");
      return;
    }
    store.clear();
    reset();
  });

  refresh();
  store.subscribe(refresh);
  return reset;
}
/**
 * Download and restore.
 *
 * The file input is hidden and driven by a button, because a bare file input is
 * unstyleable and reads as a form on a panel that has none.
 */
function initTransfer(panel) {
  const result = panel.querySelector("[data-transfer-result]");

  function say(message, ok = true) {
    if (!result) return;
    result.textContent = message;
    result.classList.toggle("is-bad", !ok);
    result.hidden = false;
  }

  panel.querySelector("[data-export]")?.addEventListener("click", () => {
    downloadExport();
    say("Downloaded. Keep it somewhere you will find it again.");
  });

  const file = panel.querySelector("[data-import-file]");
  panel.querySelector("[data-import-open]")?.addEventListener("click", () => file?.click());

  file?.addEventListener("change", async () => {
    const chosen = file.files?.[0];
    if (!chosen) return;

    let text = "";
    try {
      text = await chosen.text();
    } catch {
      say("That file could not be read.", false);
      return;
    } finally {
      // So choosing the same file twice in a row still fires a change.
      file.value = "";
    }

    const outcome = applyImport(text);
    if (!outcome.ok) say(outcome.reason, false);
    else say(describeImport(outcome));
  });
}
/**
 * What the browser is holding, counted.
 *
 * Every row is shown even at zero. A summary that hid its empty rows would
 * change shape as the reader used the site, and "no bookmarks yet" is an
 * answer to the question the panel was opened to ask.
 */
function initSummary(panel) {
  const list = panel.querySelector("[data-data-summary]");
  if (!list) return;

  function render() {
    list.replaceChildren(
      ...STORES.map(({ store, one, many }) => {
        const count = store.list().length;
        const row = document.createElement("li");
        row.className = "data-summary__row";
        if (!count) row.classList.add("is-empty");

        const value = document.createElement("span");
        value.className = "data-summary__value";
        value.textContent = String(count);

        const label = document.createElement("span");
        label.className = "data-summary__label";
        label.textContent = count === 1 ? one : many;

        row.append(value, label);
        return row;
      }),
    );
  }

  render();
  for (const { store } of STORES) store.subscribe(render);
}

export function initAccount() {
  const panel = document.querySelector("[data-account-panel]");
  const trigger = document.querySelector("[data-account-toggle]");
  if (!panel || !trigger) return;

  trigger.hidden = false;

  initSummary(panel);
  initTransfer(panel);

  /*
   * All four stores as one, so the everything button gets the same arming, the
   * same "nothing to erase" disabling and the same subscription for free —
   * rather than a second implementation of a button that destroys more.
   */
  const everything = {
    list: () => STORES.flatMap(({ store }) => store.list()),
    clear: () => {
      for (const { store } of STORES) store.clear();
    },
    subscribe: (listener) => {
      const offs = STORES.map(({ store }) => store.subscribe(listener));
      return () => offs.forEach((off) => off());
    },
  };

  const disarm = [
    ...STORES.map(({ clear, label, store }) =>
      armClearButton(panel.querySelector(clear), { label, store }),
    ),
    armClearButton(panel.querySelector("[data-clear-all]"), {
      label: "Clear everything",
      confirm: "Erase all of it?",
      store: everything,
    }),
  ];

  const overlay = createOverlay({
    panel,
    trigger,
    onClose: () => disarm.forEach((reset) => reset()),
  });

  /*
   * The menu's way in, for the widths where the header has no room for the
   * icon. The menu is shut first and focus moved to the control that shuts it,
   * so that closing the panel afterwards returns the reader to something that
   * is still on the screen rather than to a row inside a menu that is gone.
   */
  for (const opener of document.querySelectorAll("[data-account-open]")) {
    opener.addEventListener("click", () => {
      const menu = document.querySelector("[data-menu-toggle]");
      if (menu?.getAttribute("aria-expanded") === "true") {
        menu.click();
        menu.focus();
      }
      overlay.open();
    });
  }
}
