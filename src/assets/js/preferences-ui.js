import { preferences, PREFERENCES } from "./preferences.js";
import { createOverlay } from "./overlay.js";
import { bookmarkStore } from "./bookmark-store.js";
import { historyStore } from "./reading-history.js";
import { favoriteStore } from "./favorites.js";
import { downloadExport, applyImport, describeImport } from "./data-transfer.js";

/**
 * The reading-preferences panel.
 *
 * Each preference renders as a radio group, not a cycling button: a reader
 * should be able to see every option and which one is active without
 * activating anything. Choices apply immediately — there is no save step,
 * because the page itself is the preview.
 */

function optionLabel(key, value) {
  const labels = {
    theme: { system: "System", light: "Light", dark: "Dark" },
    density: { compact: "Compact", comfortable: "Comfortable", spacious: "Spacious" },
    face: { serif: "Serif", sans: "Sans" },
    spacing: { tight: "Tight", normal: "Normal", relaxed: "Relaxed" },
  };
  return labels[key]?.[value] ?? value;
}

function buildGroup(key, spec, current, onChange) {
  const group = document.createElement("div");
  group.className = "pref-group";

  const legendId = `pref-${key}-label`;
  const fieldset = document.createElement("fieldset");
  fieldset.className = "pref-group__fieldset";
  fieldset.setAttribute("aria-labelledby", legendId);

  const legend = document.createElement("legend");
  legend.className = "pref-group__label";
  legend.id = legendId;
  legend.textContent = spec.label;
  fieldset.append(legend);

  const options = document.createElement("div");
  options.className = "pref-options";

  for (const value of spec.values) {
    const id = `pref-${key}-${value}`;

    const input = document.createElement("input");
    input.type = "radio";
    input.name = `pref-${key}`;
    input.id = id;
    input.value = value;
    input.className = "pref-option__input";
    input.checked = current === value;
    input.addEventListener("change", () => {
      if (input.checked) onChange(key, value);
    });

    const label = document.createElement("label");
    label.className = "pref-option";
    label.htmlFor = id;
    label.textContent = optionLabel(key, value);

    options.append(input, label);
  }

  fieldset.append(options);
  group.append(fieldset);
  return group;
}

/**
 * A clear button that asks once.
 *
 * Erasing a reading history or a shelf of bookmarks cannot be undone, and a
 * mis-tap in a panel full of radio buttons is easy. The second press is the
 * confirmation — no native dialog, and it forgets the question on its own if
 * the reader does something else, which closing the panel counts as.
 */
function armClearButton(button, { label, store }) {
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
      button.textContent = "Sure?";
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

export function initPreferences() {
  const panel = document.querySelector("[data-preferences-panel]");
  const trigger = document.querySelector("[data-preferences-toggle]");
  if (!panel || !trigger) return;

  const body = panel.querySelector("[data-preferences-body]");
  const resetButton = panel.querySelector("[data-preferences-reset]");
  if (!body) return;

  trigger.hidden = false;

  function render() {
    const current = preferences.all();
    body.replaceChildren();
    for (const [key, spec] of Object.entries(PREFERENCES)) {
      body.append(buildGroup(key, spec, current[key], (k, v) => preferences.set(k, v)));
    }
  }

  render();

  initTransfer(panel);

  const disarm = [
    armClearButton(panel.querySelector("[data-clear-favorites]"), {
      label: "Clear favorites",
      store: favoriteStore,
    }),
    armClearButton(panel.querySelector("[data-clear-history]"), {
      label: "Clear history",
      store: historyStore,
    }),
    armClearButton(panel.querySelector("[data-clear-bookmarks]"), {
      label: "Clear bookmarks",
      store: bookmarkStore,
    }),
  ];

  createOverlay({ panel, trigger, onClose: () => disarm.forEach((reset) => reset()) });

  resetButton?.addEventListener("click", () => {
    preferences.reset();
    render();
  });

  // Another tab may have changed them; keep the radios honest.
  preferences.subscribe(render);
}
