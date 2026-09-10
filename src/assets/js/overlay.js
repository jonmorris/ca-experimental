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

  /*
   * Clicking the backdrop closes. For a modal <dialog> the backdrop is part of
   * the dialog's own box, so a click is "outside" when it lands beyond the
   * element's rectangle.
   */
  panel.addEventListener("click", (event) => {
    if (event.target !== panel) return;
    const box = panel.getBoundingClientRect();
    const outside =
      event.clientX < box.left ||
      event.clientX > box.right ||
      event.clientY < box.top ||
      event.clientY > box.bottom;
    if (outside || !isDialog) close();
  });

  // Following a link inside an overlay should leave it closed behind you.
  panel.addEventListener("click", (event) => {
    if (event.target.closest("a[href]")) close();
  });

  return { open, close, toggle, isOpen, panel, trigger };
}
