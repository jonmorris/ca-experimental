/**
 * The keyboard hint printed on the search controls.
 *
 * The palette opens on Cmd-K or Ctrl-K — it has always accepted both — but the
 * hint said ⌘K everywhere, which is a symbol most of the world's keyboards do
 * not have. On Windows and Linux it named a key the reader could not find and
 * hid the one they could.
 *
 * So the label is written at runtime rather than in the template. Every control
 * carrying it is already hidden until its script runs, so there is nothing to
 * flash and no wrong value to correct: the templates ship the Ctrl form as the
 * more likely of the two, and Apple platforms are swapped to the symbol.
 *
 * Detection is best-effort by design. `navigator.platform` is deprecated and
 * `userAgentData` is not everywhere, so this reads whichever is available and
 * falls back to the user-agent string. Being wrong costs a reader the wrong
 * word beside a control they can also simply click.
 */

const APPLE = /mac|iphone|ipad|ipod/i;

export function shortcutLabel() {
  const platform =
    navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || "";
  return APPLE.test(platform) ? "⌘K" : "Ctrl K";
}

/** Fills every `[data-shortcut-key]` on the page. */
export function initShortcutHints() {
  const label = shortcutLabel();
  for (const node of document.querySelectorAll("[data-shortcut-key]")) {
    node.textContent = label;
  }
}
