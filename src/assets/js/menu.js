/**
 * The header dropdown, shown below 1024px.
 *
 * The panel is `hidden` in the markup and unhidden here, so no-JS readers do
 * not get a toggle that does nothing — the game nav is still reachable from
 * the links on each page.
 */

const DESKTOP_QUERY = "(min-width: 1024px)";

export function initMenu() {
  const toggle = document.querySelector("[data-menu-toggle]");
  const menu = document.querySelector("[data-menu]");
  if (!toggle || !menu) return;

  // Revealed only now: without JS the panel is opened by a <noscript> rule
  // instead, so this control never appears unless it works.
  toggle.hidden = false;

  function setOpen(open) {
    toggle.setAttribute("aria-expanded", String(open));
    menu.hidden = !open;
  }

  setOpen(false);

  toggle.addEventListener("click", () => {
    setOpen(toggle.getAttribute("aria-expanded") !== "true");
  });

  // Escape closes and returns focus to the control that opened it.
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (toggle.getAttribute("aria-expanded") !== "true") return;
    setOpen(false);
    toggle.focus();
  });

  // Following a link inside the menu should leave it closed behind you.
  menu.addEventListener("click", (event) => {
    if (event.target.closest("a")) setOpen(false);
  });

  /*
   * Tapping anywhere else closes it. The dropdown is not a <dialog> — the page
   * stays scrollable behind it — so there is no backdrop to catch the tap, and
   * it has to be caught on the document.
   *
   * On `click`, not `pointerdown`. Every touch scroll begins with a
   * pointerdown, so listening for that closed the menu the instant a reader
   * put a finger on the page to scroll — the menu simply vanished, and with no
   * tap to blame it for. A gesture that moves produces no click at all, so
   * this closes on a real tap and leaves scrolling alone.
   */
  document.addEventListener("click", (event) => {
    if (toggle.getAttribute("aria-expanded") !== "true") return;
    if (menu.contains(event.target) || toggle.contains(event.target)) return;
    setOpen(false);
  });

  // Crossing into the desktop layout hides the dropdown; leave it collapsed so
  // it does not reappear open when the viewport narrows again.
  const desktop = window.matchMedia(DESKTOP_QUERY);
  desktop.addEventListener("change", (event) => {
    if (event.matches) setOpen(false);
  });
}
