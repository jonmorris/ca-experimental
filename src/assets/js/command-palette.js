import { createOverlay } from "./overlay.js";
import { bookmarkStore } from "./bookmark-store.js";
import { getSections } from "./section-tracker.js";
import { searchText } from "./search.js";
import { rank } from "./fuzzy.js";

/**
 * The command palette — Cmd-K / Ctrl-K.
 *
 * Scoped to the current game by default, because at a table you are in one
 * rulebook and results from another game are noise. It searches three things
 * without touching the network: the sections of the page you are on, this
 * game's pages and glossary terms (embedded at build time), and your
 * bookmarks, which are pinned to the top because a bookmarked rule is one you
 * have already decided matters.
 *
 * Typing `>` at the start widens the search to every game.
 *
 * It is also the site's only search interface. Navigation targets resolve
 * instantly from the embedded index; full-text results arrive a moment later
 * from Pagefind and are appended under their own heading, so one control
 * answers both "take me to the mergers section" and "which rule mentions
 * siap faji".
 */

const MAX_PER_GROUP = 6;

export function initCommandPalette() {
  const panel = document.querySelector("[data-palette]");
  const trigger = document.querySelector("[data-palette-toggle]");
  if (!panel) return;

  const input = panel.querySelector("[data-palette-input]");
  const list = panel.querySelector("[data-palette-results]");
  const empty = panel.querySelector("[data-palette-empty]");
  const scopeNote = panel.querySelector("[data-palette-scope]");
  if (!input || !list) return;

  trigger?.removeAttribute("hidden");

  // Built at build time into a script tag — no fetch, works offline.
  let index = [];
  try {
    index = JSON.parse(document.querySelector("[data-palette-index]")?.textContent || "[]");
  } catch {
    index = [];
  }

  const gameSlug = document.body.dataset.game || null;
  const gameTitle = document.body.dataset.gameTitle || "this game";
  let activeIndex = 0;
  let entries = [];

  const overlay = createOverlay({
    panel,
    trigger,
    onOpen: () => {
      input.value = "";
      render("");
      requestAnimationFrame(() => input.focus());
    },
  });

  function sectionEntries() {
    return getSections().map((section) => ({
      label: section.title,
      href: `#${section.id}`,
      group: "On this page",
    }));
  }

  function bookmarkEntries(global) {
    return bookmarkStore
      .list(global ? {} : { gameSlug })
      .map((bookmark) => ({
        label: bookmark.title,
        detail: bookmark.ruleTitle,
        href: bookmark.url,
        group: "Bookmarks",
      }));
  }

  function render(rawQuery) {
    const global = rawQuery.startsWith(">");
    const query = (global ? rawQuery.slice(1) : rawQuery).trim();

    if (scopeNote) {
      scopeNote.textContent = global
        ? "Searching all games"
        : gameSlug
          ? `Searching ${gameTitle} — type > to search all games`
          : "Searching all games";
    }

    const scoped = global || !gameSlug
      ? index
      : index.filter((item) => item.gameSlug === gameSlug);

    /*
     * A section of the page you are on appears in the embedded index too, and
     * a bookmark points at a section. Without this the same destination is
     * offered two or three times over. Whichever group lists it first wins,
     * which is the order they are ranked in: bookmarks, then this page, then
     * everything else.
     */
    const seen = new Set();
    const here = window.location.pathname;
    const dedupe = (list) =>
      list.filter((entry) => {
        const target = entry.href.startsWith("#") ? `${here}${entry.href}` : entry.href;
        if (seen.has(target)) return false;
        seen.add(target);
        return true;
      });

    entries = [
      ...dedupe(rank(bookmarkEntries(global), query)),
      ...(gameSlug && !global ? dedupe(rank(sectionEntries(), query)) : []),
      ...dedupe(
        rank(
          scoped.map((item) => ({
            label: item.label,
            detail: item.detail,
            href: item.url,
            group: global || !gameSlug ? item.gameTitle : item.group,
          })),
          query,
          12,
        ),
      ),
    ];

    list.replaceChildren();
    activeIndex = 0;

    if (!entries.length) {
      if (empty) {
        empty.hidden = false;
        empty.textContent = query
          ? `Nothing matching “${query}”.`
          : "Start typing to jump to a section or a term.";
      }
      return;
    }
    if (empty) empty.hidden = true;

    let lastGroup = null;
    entries.forEach((entry, i) => {
      if (entry.group !== lastGroup) {
        const heading = document.createElement("li");
        heading.className = "palette__group";
        heading.setAttribute("role", "presentation");
        heading.textContent = entry.group;
        list.append(heading);
        lastGroup = entry.group;
      }

      const item = document.createElement("li");
      item.className = "palette__item";
      item.setAttribute("role", "option");
      item.id = `palette-item-${i}`;
      item.setAttribute("aria-selected", String(i === activeIndex));

      const link = document.createElement("a");
      link.className = "palette__link";
      link.href = entry.href;
      link.tabIndex = -1;

      const label = document.createElement("span");
      label.className = "palette__label";
      label.textContent = entry.label;
      link.append(label);

      if (entry.detail) {
        const detail = document.createElement("span");
        detail.className = "palette__detail";
        detail.textContent = entry.detail;
        link.append(detail);
      }

      item.append(link);
      item.addEventListener("mouseenter", () => setActive(i));
      list.append(item);
    });

    setActive(0);
  }

  function setActive(next) {
    const items = [...list.querySelectorAll(".palette__item")];
    if (!items.length) return;
    activeIndex = (next + items.length) % items.length;
    items.forEach((item, i) => item.setAttribute("aria-selected", String(i === activeIndex)));
    const active = items[activeIndex];
    active?.scrollIntoView({ block: "nearest" });
    input.setAttribute("aria-activedescendant", active?.id || "");
  }

  /**
   * Full-text results are appended after the instant ones. A slower query must
   * never overwrite the results of a later keystroke, hence the guard.
   */
  async function appendTextResults(rawQuery) {
    const global = rawQuery.startsWith(">");
    const query = (global ? rawQuery.slice(1) : rawQuery).trim();
    if (query.length < 2) return;

    const scope = global || !gameSlug ? null : gameSlug;
    const found = await searchText(query, { gameSlug: scope });
    if (input.value !== rawQuery) return;

    if (!found.ok) {
      const note = document.createElement("li");
      note.className = "palette__note";
      note.setAttribute("role", "presentation");
      note.textContent = "Full-text search unavailable — run `npm run build` to create the index.";
      list.append(note);
      return;
    }

    const fresh = found.results.filter(
      (result) => !entries.some((entry) => entry.href === result.url),
    );
    if (!fresh.length) return;

    if (empty) empty.hidden = true;

    const heading = document.createElement("li");
    heading.className = "palette__group";
    heading.setAttribute("role", "presentation");
    heading.textContent = found.total > fresh.length
      ? `In the text (${found.total} matches)`
      : "In the text";
    list.append(heading);

    for (const result of fresh) {
      const index = entries.length;
      entries.push({ label: result.title, href: result.url, group: "In the text" });

      const item = document.createElement("li");
      item.className = "palette__item";
      item.setAttribute("role", "option");
      item.id = `palette-item-${index}`;
      item.setAttribute("aria-selected", "false");

      const link = document.createElement("a");
      link.className = "palette__link";
      link.href = result.url;
      link.tabIndex = -1;

      const label = document.createElement("span");
      label.className = "palette__label";
      label.textContent = result.title;
      link.append(label);

      if (result.excerpt) {
        const detail = document.createElement("span");
        detail.className = "palette__detail";
        // Pagefind's excerpt is built from indexed content and contains only
        // <mark> elements, so it is safe to insert as markup.
        detail.innerHTML = result.excerpt;
        link.append(detail);
      }

      item.append(link);
      item.addEventListener("mouseenter", () => setActive(index));
      list.append(item);
    }
  }

  let queryToken = 0;
  input.addEventListener("input", () => {
    const value = input.value;
    render(value);
    const token = ++queryToken;
    // A short delay so a fast typist does not queue a query per keystroke.
    setTimeout(() => {
      if (token === queryToken && input.value === value) appendTextResults(value);
    }, 160);
  });

  input.addEventListener("keydown", (event) => {
    const items = [...list.querySelectorAll(".palette__item")];
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive(activeIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(activeIndex - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      items[activeIndex]?.querySelector("a")?.click();
    }
  });

  document.addEventListener("keydown", (event) => {
    const isShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
    if (!isShortcut) return;
    event.preventDefault();
    overlay?.toggle();
  });
}
