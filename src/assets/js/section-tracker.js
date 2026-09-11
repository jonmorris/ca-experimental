/**
 * Which section is being read.
 *
 * Three things need this answer — the sticky bar on mobile, the highlighted
 * entry in the desktop sidebar, and the prev/next controls — so it is computed
 * once, from one scroll listener, and published to subscribers. Three
 * independent scroll handlers would be three chances to disagree about where
 * the reader is.
 */

/*
 * The line across the viewport that decides which section you are in. It has
 * to be the same line the browser parks an anchored heading on, which is the
 * root's scroll-padding-top — header, sticky bar and a gap. Hard-coding it at
 * 96px was 16px short of the real 112, so clicking a section in the jump list
 * left the bar naming the section before it: the heading landed just under the
 * line without crossing it, and a nudge of the wheel was what finally moved it.
 */
let offset = 96;

function readOffset() {
  const padding = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop);
  offset = Number.isFinite(padding) ? padding : 96;
}

let sections = [];
let currentIndex = 0;
/*
 * Set while a click on a section link is still travelling. A smooth scroll
 * across a long rulebook takes over a second, and the reader is at the section
 * they chose from the moment they choose it — not wherever the animation has
 * got to.
 */
let pinnedIndex = null;
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
    // A pixel of tolerance: a heading parked exactly on the line has arrived.
    if (sections[i].element.getBoundingClientRect().top - offset <= 1) index = i;
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

  if (pinnedIndex !== null) {
    // Hold until the scroll arrives where it was sent. It is released here
    // rather than on a timer so a section too short to reach the line — the
    // last one, at the bottom of the document — still reads as current.
    if (index === pinnedIndex) pinnedIndex = null;
    return;
  }

  if (index === currentIndex) return;
  currentIndex = index;
  publish();
}

/**
 * Names the section the reader has just asked for, before the scroll arrives.
 * Ignores an id that is not a section — a cross-reference to a numbered rule
 * lands mid-section, and where that leaves the reader is for the scroll to say.
 */
function pinSection(id) {
  const index = sections.findIndex((section) => section.id === id);
  if (index < 0) return;

  pinnedIndex = index;
  if (index !== currentIndex) {
    currentIndex = index;
    publish();
  }
}

/* Any scroll the reader makes themselves hands tracking back. */
function releasePin() {
  pinnedIndex = null;
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

  readOffset();
  currentIndex = computeIndex();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => {
    // The offset is built from rem-based tokens, and the density preference
    // moves them.
    readOffset();
    onScroll();
  }, { passive: true });

  for (const event of ["wheel", "touchstart", "keydown", "pointerdown"]) {
    window.addEventListener(event, releasePin, { passive: true });
  }

  /*
   * Every route to a section goes through the hash — the jump list, the
   * sidebar, prev/next, the back button — so this is the one place that needs
   * to know a jump has started. Reading it here rather than from a click also
   * keeps publish() out of the click's way: prev/next rewrite their own hrefs
   * whenever the current section changes, and a listener that published during
   * the click retargeted the very link being followed.
   */
  window.addEventListener("hashchange", () => {
    pinSection(decodeURIComponent(window.location.hash.slice(1)));
    // A deep link lands after layout; recompute once the browser has scrolled.
    requestAnimationFrame(update);
  });
  requestAnimationFrame(update);

  publish();
  return true;
}
