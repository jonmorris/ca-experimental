import { preferences, PREFERENCES } from "./preferences.js";
import { createOverlay } from "./overlay.js";

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
    face: { default: "Default", serif: "Serif", sans: "Sans" },
    measure: { narrow: "Narrow", default: "Default", wide: "Wide" },
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
  createOverlay({ panel, trigger });

  resetButton?.addEventListener("click", () => {
    preferences.reset();
    render();
  });

  // Another tab may have changed them; keep the radios honest.
  preferences.subscribe(render);
}
