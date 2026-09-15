import { onSectionChange } from "./section-tracker.js";
import { createOverlay } from "./overlay.js";
import { withBasePath } from "./base-path.js";

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
 *
 * All three also cope with a document whose sections are not known until the
 * browser has built them. My Reference is assembled out of the reader's
 * bookmarks, so it arrives with an empty jump list, a bar that names nothing
 * and a pager with nowhere to go — and then, one publish later, with all
 * three filled. Nothing here reads the DOM once and keeps the answer.
 */

/**
 * Writes a jump list the build could not write.
 *
 * Same markup the `sectionList` macro produces, so one stylesheet and one set
 * of `[data-jump-anchor]` handlers serve both. The base is carried on the list
 * rather than taken from `location`, and unlike an href in the markup it is
 * not rewritten by the build's base plugin — so it is prefixed here.
 */
function fillJumpList(list, sections) {
  const base = withBasePath(list.dataset.jumpBase || window.location.pathname);

  list.replaceChildren(
    ...sections.map((section, i) => {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.className = "jump-link";
      link.href = `${base}#${section.id}`;
      link.dataset.jumpAnchor = section.id;

      const index = document.createElement("span");
      index.className = "jump-link__index";
      index.setAttribute("aria-hidden", "true");
      index.textContent = String(i + 1);

      const title = document.createElement("span");
      title.className = "jump-link__title";
      title.textContent = section.title;

      link.append(index, title);
      item.append(link);
      return item;
    }),
  );
}

/**
 * Fills a jump list when what it is showing is not what the document says.
 *
 * It used to fill only an empty list, which was right while the only page whose
 * sections arrived late was one that started with none. My Reference can now be
 * reordered, and then the list has children and the wrong ones: same sections,
 * different sequence, and a contents list that disagrees with the page it
 * belongs to is worse than one that is missing.
 *
 * Compared against the list's own anchors rather than against a flag, so a
 * server-rendered list on a rulebook is left exactly as the build wrote it —
 * the comparison says "already correct" and nothing is touched.
 */
function syncJumpList(list, sections) {
  if (!list) return;

  const wanted = sections.map((section) => section.id).join("|");
  const showing = [...list.querySelectorAll("[data-jump-anchor]")]
    .map((link) => link.dataset.jumpAnchor)
    .join("|");
  if (showing === wanted) return;

  fillJumpList(list, sections);
}

/** Marks the entry for the current section in one list. */
function markCurrent(root, current, onCurrent) {
  for (const link of root.querySelectorAll("[data-jump-anchor]")) {
    const isCurrent = current && link.dataset.jumpAnchor === current.id;
    link.classList.toggle("is-current", Boolean(isCurrent));
    if (!isCurrent) {
      link.removeAttribute("aria-current");
      continue;
    }
    link.setAttribute("aria-current", "true");
    onCurrent?.(link);
  }
}

function initStickyBar() {
  const bar = document.querySelector("[data-section-bar]");
  if (!bar) return;

  const label = bar.querySelector("[data-section-bar-label]");
  const trigger = bar.querySelector("[data-section-bar-toggle]");
  const panel = document.querySelector("[data-section-jump]");
  const position = bar.querySelector("[data-section-bar-position]");

  // Only when there is a sheet to open.
  if (!panel || !trigger) return;

  createOverlay({ panel, trigger });

  const list = panel.querySelector("[data-jump-list]");

  onSectionChange(({ current, index, sections }) => {
    /*
     * Revealed by the sections, not by the markup. A page with one section —
     * or none yet — gets no bar, because a control that names the only thing
     * on the page and opens a list of one is furniture.
     */
    bar.hidden = sections.length < 2;
    if (bar.hidden) return;

    syncJumpList(list, sections);

    if (label && current) label.textContent = current.title;
    if (position) position.textContent = `${index + 1} / ${sections.length}`;

    // Mark the active entry in the jump list too, so opening it shows where
    // you are rather than making you find it.
    markCurrent(panel, current);
  });
}

function initSidebar() {
  const sidebar = document.querySelector("[data-sidebar-sections]");
  if (!sidebar) return;

  const list = sidebar.querySelector("[data-jump-list]");

  onSectionChange(({ current, sections }) => {
    /*
     * The block is hidden until it has something to list, and the links are
     * looked up again on every change rather than kept from the first one —
     * on My Reference the first change is the one that creates them.
     */
    sidebar.hidden = sections.length === 0;
    if (sidebar.hidden) return;

    syncJumpList(list, sections);
    if (!current) return;

    markCurrent(sidebar, current, (link) => {
      // Keep the active entry visible without yanking the whole page.
      const box = link.getBoundingClientRect();
      const frame = sidebar.getBoundingClientRect();
      if (box.top < frame.top || box.bottom > frame.bottom) {
        link.scrollIntoView({ block: "nearest" });
      }
    });
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

  onSectionChange(({ previous, next, sections }) => {
    for (const control of controls) {
      // Nowhere to step on a page of one section, or on one whose sections
      // have not been built yet.
      control.hidden = sections.length < 2;

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
