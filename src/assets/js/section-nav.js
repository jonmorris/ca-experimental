import { onSectionChange } from "./section-tracker.js";
import { createOverlay } from "./overlay.js";

/**
 * Everything that follows the reader's position through a long document:
 *
 *  - the sticky bar (below the sidebar breakpoint) naming the current section,
 *    which opens the full jump list on tap;
 *  - the highlighted entry in the desktop sidebar, which also scrolls itself
 *    into view so the current section is never off-screen in the nav;
 *  - the prev / next controls.
 *
 * All three read from `section-tracker.js`, so they can never disagree.
 */

function initStickyBar() {
  const bar = document.querySelector("[data-section-bar]");
  if (!bar) return;

  const label = bar.querySelector("[data-section-bar-label]");
  const trigger = bar.querySelector("[data-section-bar-toggle]");
  const panel = document.querySelector("[data-section-jump]");
  const position = bar.querySelector("[data-section-bar-position]");

  /*
   * Only when there is a list to open. My Reference has no sections at build
   * time — it assembles itself in the browser — so without this the page shows
   * a bar that names nothing and opens nothing.
   */
  if (!panel || !trigger) return;

  bar.hidden = false;
  createOverlay({ panel, trigger });

  onSectionChange(({ current, index, sections }) => {
    if (label && current) label.textContent = current.title;
    if (position && sections.length) {
      position.textContent = `${index + 1} / ${sections.length}`;
    }

    // Mark the active entry in the jump list too, so opening it shows where
    // you are rather than making you find it.
    if (!panel || !current) return;
    for (const link of panel.querySelectorAll("[data-jump-anchor]")) {
      const isCurrent = link.dataset.jumpAnchor === current.id;
      link.classList.toggle("is-current", isCurrent);
      if (isCurrent) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    }
  });
}

function initSidebar() {
  const sidebar = document.querySelector("[data-sidebar-sections]");
  if (!sidebar) return;

  const links = [...sidebar.querySelectorAll("[data-jump-anchor]")];
  if (!links.length) return;

  onSectionChange(({ current }) => {
    if (!current) return;
    for (const link of links) {
      const isCurrent = link.dataset.jumpAnchor === current.id;
      link.classList.toggle("is-current", isCurrent);
      if (isCurrent) {
        link.setAttribute("aria-current", "true");
        // Keep the active entry visible without yanking the whole page.
        const box = link.getBoundingClientRect();
        const frame = sidebar.getBoundingClientRect();
        if (box.top < frame.top || box.bottom > frame.bottom) {
          link.scrollIntoView({ block: "nearest" });
        }
      } else {
        link.removeAttribute("aria-current");
      }
    }
  });
}

function initPrevNext() {
  const controls = [...document.querySelectorAll("[data-rulebook-nav]")];
  if (!controls.length) return;

  const base = controls[0].dataset.rulebookBase || window.location.pathname;

  function setLink(link, labelNode, section) {
    if (!link) return;
    if (!section) {
      link.setAttribute("aria-disabled", "true");
      link.removeAttribute("href");
      if (labelNode) labelNode.textContent = "—";
      return;
    }
    link.removeAttribute("aria-disabled");
    link.href = `${base}#${section.id}`;
    if (labelNode) labelNode.textContent = section.title;
  }

  onSectionChange(({ previous, next }) => {
    for (const control of controls) {
      setLink(
        control.querySelector("[data-rulebook-prev]"),
        control.querySelector("[data-rulebook-prev-label]"),
        previous,
      );
      setLink(
        control.querySelector("[data-rulebook-next]"),
        control.querySelector("[data-rulebook-next-label]"),
        next,
      );
    }
  });
}

export function initSectionNav() {
  initStickyBar();
  initSidebar();
  initPrevNext();
}
