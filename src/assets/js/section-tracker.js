/**
 * Which section is being read.
 *
 * Three things need this answer — the sticky bar on mobile, the highlighted
 * entry in the desktop sidebar, and the prev/next controls — so it is computed
 * once, from one scroll listener, and published to subscribers. Three
 * independent scroll handlers would be three chances to disagree about where
 * the reader is.
 */

const OFFSET = 96;

let sections = [];
let currentIndex = 0;
const listeners = new Set();

function readSections() {
  return [...document.querySelectorAll(".section-heading h2[id]")].map((heading) => ({
    id: heading.id,
    title: heading.textContent.trim(),
    element: heading.closest(".section-heading") || heading,
  }));
}

/**
 * The current section is the last one whose heading has passed the top of the
 * reading area — computed from position rather than from IntersectionObserver
 * entries, which get ambiguous when several short sections are on screen.
 */
function computeIndex() {
  let index = 0;
  for (let i = 0; i < sections.length; i += 1) {
    if (sections[i].element.getBoundingClientRect().top - OFFSET <= 0) index = i;
    else break;
  }
  return index;
}

function publish() {
  const state = {
    sections,
    index: currentIndex,
    current: sections[currentIndex] || null,
    previous: sections[currentIndex - 1] || null,
    next: sections[currentIndex + 1] || null,
  };
  for (const listener of listeners) listener(state);
}

function update() {
  const index = computeIndex();
  if (index === currentIndex) return;
  currentIndex = index;
  publish();
}

let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    update();
  });
}

/** Subscribes to section changes and immediately receives the current state. */
export function onSectionChange(listener) {
  listeners.add(listener);
  listener({
    sections,
    index: currentIndex,
    current: sections[currentIndex] || null,
    previous: sections[currentIndex - 1] || null,
    next: sections[currentIndex + 1] || null,
  });
  return () => listeners.delete(listener);
}

export function getSections() {
  return sections;
}

export function initSectionTracker() {
  sections = readSections();
  if (sections.length < 2) return false;

  currentIndex = computeIndex();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });

  // A deep link lands after layout; recompute once the browser has scrolled.
  window.addEventListener("hashchange", () => requestAnimationFrame(update));
  requestAnimationFrame(update);

  publish();
  return true;
}
