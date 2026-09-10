/**
 * The overlay primitive.
 *
 * The command palette, the bookmarks drawer and the reading-preferences panel
 * are all the same thing: a dismissible layer opened from a button, which must
 * trap focus, close on Escape or an outside click, and give focus back to
 * whatever opened it. Writing that three times is three chances to get the
 * accessibility wrong, so it is written once.
 *
 * Uses <dialog> where the markup provides one, which gets focus trapping and
 * inertness from the browser rather than from a hand-rolled key handler.
 */

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function firstFocusable(root) {
  return [...root.querySelectorAll(FOCUSABLE)].find(
    (el) => el.offsetParent !== null || getComputedStyle(el).position === "fixed",
  );
}

/**
 * @param {object} options
 * @param {HTMLElement} options.panel     the layer itself, ideally a <dialog>
 * @param {HTMLElement} [options.trigger] the control that opens it
 * @param {() => void}  [options.onOpen]
 * @param {() => void}  [options.onClose]
 */
export function createOverlay({ panel, trigger, onOpen, onClose } = {}) {
  if (!panel) return null;

  const isDialog = panel.tagName === "DIALOG";
  let lastFocused = null;

  function isOpen() {
    return isDialog ? panel.open : !panel.hidden;
  }

  function open() {
    if (isOpen()) return;
    lastFocused = document.activeElement;

    if (isDialog) panel.showModal();
    else panel.hidden = false;

    trigger?.setAttribute("aria-expanded", "true");
    document.documentElement.classList.add("has-overlay");
    onOpen?.();
    firstFocusable(panel)?.focus();
  }

  function close() {
    if (!isOpen()) return;

    if (isDialog) panel.close();
    else panel.hidden = true;

    trigger?.setAttribute("aria-expanded", "false");
    document.documentElement.classList.remove("has-overlay");
    onClose?.();

    // Focus goes back where it came from, not to the top of the document.
    if (lastFocused instanceof HTMLElement && lastFocused.isConnected) lastFocused.focus();
    else trigger?.focus();
  }

  function toggle() {
    if (isOpen()) close();
    else open();
  }

  trigger?.addEventListener("click", toggle);

  // A <dialog> already closes on Escape; this keeps our state in step.
  panel.addEventListener("cancel", () => {
    trigger?.setAttribute("aria-expanded", "false");
    document.documentElement.classList.remove("has-overlay");
    onClose?.();
  });

  if (!isDialog) {
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && isOpen()) close();
    });
  }

  // Any explicit close control inside the overlay.
  for (const button of panel.querySelectorAll("[data-overlay-close]")) {
    button.addEventListener("click", close);
  }

  panel.addEventListener("click", (event) => {
    /*
     * Clicking away closes. These dialogs fill the viewport and the visible
     * surface is a child element, so a click that lands on the dialog itself —
     * rather than on any descendant — is a click on the dimmed area around the
     * panel. Comparing against the dialog's own bounding box does not work
     * here: the box covers the whole screen, so nothing is ever outside it.
     */
    if (event.target === panel) {
      close();
      return;
    }

    // Following a link inside an overlay should leave it closed behind you.
    if (event.target.closest("a[href]")) close();
  });

  return { open, close, toggle, isOpen, panel, trigger };
}
