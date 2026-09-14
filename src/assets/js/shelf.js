/**
 * Sorting and filtering the shelf.
 *
 * Everything happens to tiles already on the page: the build writes all of
 * them, alphabetically, and this reorders and hides. Nothing is fetched, no
 * second copy of the catalogue exists to fall out of step with the first, and
 * a reader without JavaScript still gets the whole shelf in a sensible order.
 *
 * Each tile carries what it is sorted and filtered by as data attributes,
 * parsed at build time — see `lib/shelf.js`. The only thing this file knows
 * about a game is four numbers and a title.
 */

/*
 * What each key's two directions are called, ascending first — and which of
 * them a key starts on.
 *
 * Names start at A and dates start at the newest, because those are the
 * answers each question is usually asked for: nobody opens a shelf wanting the
 * oldest game on it first, and the alphabet has no equivalent pull the other
 * way. Switching key therefore sets a sensible direction rather than carrying
 * the last one across, where "Z to A" would have quietly become "oldest
 * first".
 */
const SORTS = {
  title: { labels: ["A to Z", "Z to A"], descending: false },
  year: { labels: ["Oldest first", "Newest first"], descending: true },
};

/**
 * Two ranges overlap if either starts before the other ends.
 *
 * Overlap rather than containment, because a game that plays 2–5 belongs in a
 * search for three players, and a game that runs 60–120 minutes belongs in
 * "we have an hour" — the reader is asking whether this game can meet them,
 * not whether it lives entirely inside their window.
 */
function overlaps(low, high, min, max) {
  return low <= max && high >= min;
}

function readTile(tile) {
  const number = (name) => {
    const value = Number(tile.dataset[name]);
    return Number.isFinite(value) ? value : null;
  };
  return {
    el: tile,
    title: tile.dataset.title || "",
    year: number("year"),
    // A game published by two houses belongs under both.
    publishers: (tile.dataset.publishers || "").split(" ").filter(Boolean),
    players: [number("playersMin"), number("playersMax")],
    time: [number("timeMin"), number("timeMax")],
  };
}

/**
 * One slider with two handles.
 *
 * The handles are two real range inputs on one track, so each is focusable and
 * arrow-key operable without any of that being written here. Two rules make
 * them one control: neither may cross the other, and whichever the pointer is
 * nearer is the one that receives it — without that, the upper handle sitting
 * at the maximum covers the whole track and the lower one can never be
 * grabbed.
 */
function createRange(root, onChange) {
  const lower = root.querySelector("[data-range-lower]");
  const upper = root.querySelector("[data-range-upper]");
  const fill = root.querySelector("[data-range-fill]");
  const value = root.querySelector("[data-range-value]");
  if (!lower || !upper) return null;

  const min = Number(root.dataset.rangeMin);
  const max = Number(root.dataset.rangeMax);
  const unit = root.dataset.rangeUnit || "";

  function label(from, to) {
    const span = from === to ? `${from}` : `${from}–${to}`;
    const plural = to === 1 ? unit : `${unit}s`;
    return unit ? `${span} ${plural}` : span;
  }

  function paint() {
    const from = Number(lower.value);
    const to = Number(upper.value);
    const span = max - min || 1;
    if (fill) {
      fill.style.insetInlineStart = `${((from - min) / span) * 100}%`;
      fill.style.insetInlineEnd = `${((max - to) / span) * 100}%`;
    }
    if (value) value.textContent = label(from, to);
    root.classList.toggle("is-narrowed", from > min || to < max);
  }

  function clamp(moved) {
    if (Number(lower.value) > Number(upper.value)) {
      if (moved === lower) upper.value = lower.value;
      else lower.value = upper.value;
    }
  }

  for (const input of [lower, upper]) {
    input.addEventListener("input", () => {
      clamp(input);
      paint();
      onChange();
    });
  }

  /*
   * Both inputs cover the whole track, so the one on top would take every
   * press. This hands each press to the nearer handle for its duration.
   */
  root.querySelector(".range__track")?.addEventListener("pointerdown", (event) => {
    const box = event.currentTarget.getBoundingClientRect();
    const at = min + ((event.clientX - box.left) / box.width) * (max - min);
    const nearer =
      Math.abs(at - Number(lower.value)) <= Math.abs(at - Number(upper.value)) ? lower : upper;
    lower.style.pointerEvents = nearer === lower ? "auto" : "none";
    upper.style.pointerEvents = nearer === upper ? "auto" : "none";
  });

  function reset() {
    lower.value = String(min);
    upper.value = String(max);
    paint();
  }

  paint();

  return {
    reset,
    get from() {
      return Number(lower.value);
    },
    get to() {
      return Number(upper.value);
    },
    get isDefault() {
      return Number(lower.value) === min && Number(upper.value) === max;
    },
  };
}

/**
 * A menu button and its list.
 *
 * Small enough to live here because the shelf is the only thing that needs
 * one — and written at all because a `<select>`'s open list belongs to the
 * operating system, so the one moment the control is being used is the one
 * moment it stops looking like the site.
 *
 * Both of the shelf's menus are this: what a menu is *for* is entirely in the
 * callback, so sorting and filtering by publisher share the keyboard, the
 * tick, and every way of closing.
 *
 * What a select gave away for free is the keyboard, and that is most of what
 * follows: the arrows open the menu and walk it, Home and End jump, Escape and
 * Tab close it, and focus always ends up back on the button. Focus moves item
 * to item rather than staying on the list with `aria-activedescendant`,
 * because a real focus ring is a thing browsers and screen readers already
 * agree about.
 *
 * @param {HTMLElement} root    the wrapper, positioned
 * @param {(key: string) => void} onChoose called with the chosen item's key
 */
function createMenu(root, onChoose) {
  const button = root.querySelector("[data-menu-button]");
  const list = root.querySelector("[data-menu-list]");
  if (!button || !list) return null;

  const items = [...list.querySelectorAll("[data-menu-item]")];

  const isOpen = () => !list.hidden;

  function open(focus = "checked") {
    list.hidden = false;
    button.setAttribute("aria-expanded", "true");

    const checked = items.find((item) => item.getAttribute("aria-checked") === "true");
    const target =
      focus === "last" ? items[items.length - 1] : focus === "first" ? items[0] : checked || items[0];
    target?.focus();
  }

  function close({ restoreFocus = true } = {}) {
    if (!isOpen()) return;
    list.hidden = true;
    button.setAttribute("aria-expanded", "false");
    if (restoreFocus) button.focus();
  }

  function step(from, delta) {
    const index = items.indexOf(from);
    // Wraps, which is what a menu of two badly wants: one press either way
    // reaches the other item.
    items[(index + delta + items.length) % items.length]?.focus();
  }

  button.addEventListener("click", () => (isOpen() ? close() : open()));

  button.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      open(event.key === "ArrowUp" ? "last" : "first");
    }
  });

  list.addEventListener("keydown", (event) => {
    const item = event.target.closest("[data-menu-item]");
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        step(item, 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        step(item, -1);
        break;
      case "Home":
        event.preventDefault();
        items[0]?.focus();
        break;
      case "End":
        event.preventDefault();
        items[items.length - 1]?.focus();
        break;
      case "Escape":
        event.preventDefault();
        close();
        break;
      case "Tab":
        // Let the tab land where it was going; just do not leave this behind.
        close({ restoreFocus: false });
        break;
      default:
    }
  });

  for (const item of items) {
    item.addEventListener("click", () => {
      onChoose(item.dataset.menuItem);
      close();
    });
  }

  /*
   * Tapping anywhere else closes it. On `click` and not `pointerdown`, for the
   * reason the header menu gives: every touch scroll starts with a
   * pointerdown, and closing on that makes the menu vanish under a finger that
   * was only scrolling.
   */
  document.addEventListener("click", (event) => {
    if (!isOpen() || root.contains(event.target)) return;
    close({ restoreFocus: false });
  });

  return {
    close,
    /** Marks the chosen item and writes its name onto the button. */
    set(key) {
      for (const item of items) {
        const isCurrent = item.dataset.menuItem === key;
        item.setAttribute("aria-checked", String(isCurrent));
        if (isCurrent) {
          const value = root.querySelector("[data-menu-value]");
          if (value) value.textContent = item.querySelector("span")?.textContent.trim() || "";
        }
      }
    },
  };
}

export function initShelf() {
  const tools = document.querySelector("[data-shelf-tools]");
  const list = document.querySelector("[data-shelf-list]");
  if (!tools || !list) return;

  const tiles = [...list.querySelectorAll(".game-tile")].map(readTile);
  if (!tiles.length) return;

  const direction = tools.querySelector("[data-shelf-direction]");
  const directionLabel = tools.querySelector("[data-shelf-direction-label]");
  const reset = tools.querySelector("[data-shelf-reset]");
  const toggle = document.querySelector("[data-shelf-toggle]");
  const badge = document.querySelector("[data-shelf-badge]");
  const count = document.querySelector("[data-shelf-count]");
  const empty = document.querySelector("[data-shelf-empty]");

  let sortKey = "title";
  let descending = SORTS.title.descending;

  /*
   * A new key starts on its own default direction rather than inheriting the
   * last one, where "Z to A" would quietly have become "oldest first".
   */
  const menu = createMenu(tools.querySelector('[data-menu="sort"]'), (key) =>
    setSort(key, (SORTS[key] || SORTS.title).descending),
  );

  /* The empty key is "all publishers", which is the filter doing nothing. */
  let publisher = "";
  const publisherMenu = createMenu(tools.querySelector('[data-menu="publisher"]'), (key) => {
    publisher = key;
    publisherMenu?.set(publisher);
    apply();
  });

  const ranges = {};
  for (const root of tools.querySelectorAll("[data-range]")) {
    const range = createRange(root, apply);
    if (range) ranges[root.dataset.range] = range;
  }

  function matches(tile) {
    const players = ranges.players;
    const time = ranges.time;

    /*
     * A game with nothing recorded is shown while the filter is untouched and
     * dropped once it is narrowed. Neither pretending it matches nor hiding it
     * from an unfiltered shelf would be honest.
     */
    if (players && !players.isDefault) {
      if (tile.players[0] === null) return false;
      if (!overlaps(tile.players[0], tile.players[1], players.from, players.to)) return false;
    }
    if (time && !time.isDefault) {
      if (tile.time[0] === null) return false;
      if (!overlaps(tile.time[0], tile.time[1], time.from, time.to)) return false;
    }
    if (publisher && !tile.publishers.includes(publisher)) return false;
    return true;
  }

  /*
   * The whole comparison, direction included.
   *
   * It used to be flipped by the caller, with one exception bolted on for a
   * game that has no year — which meant a shelf sorted by name and facing Z to
   * A stopped inverting the moment one of the two games being compared had no
   * year recorded, because the exception was written against the sort it was
   * about but applied to both.
   */
  function compare(a, b) {
    if (sortKey === "year") {
      // A game with no year sorts to the end, whichever way the list is facing.
      if (a.year === null || b.year === null) {
        if (a.year === b.year) return a.title.localeCompare(b.title);
        return a.year === null ? 1 : -1;
      }
      if (a.year !== b.year) return descending ? b.year - a.year : a.year - b.year;
      return a.title.localeCompare(b.title);
    }

    const order = a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
    return descending ? -order : order;
  }

  function apply() {
    const shown = tiles.filter(matches);
    shown.sort(compare);

    for (const tile of tiles) tile.el.hidden = true;
    for (const tile of shown) {
      tile.el.hidden = false;
      list.append(tile.el);
    }

    if (count) count.textContent = String(shown.length);
    if (empty) empty.hidden = shown.length > 0;

    /*
     * How many filters are doing something. Shown on the closed tray, because
     * a shelf that is quietly narrowed reads as a shelf with games missing.
     */
    const narrowed =
      Object.values(ranges).filter((range) => !range.isDefault).length + (publisher ? 1 : 0);
    if (reset) reset.hidden = narrowed === 0;
    if (badge) {
      badge.hidden = narrowed === 0;
      badge.textContent = String(narrowed);
    }
    toggle?.classList.toggle("is-filtering", narrowed > 0);
  }

  /**
   * Draws the sort control and re-sorts.
   *
   * The direction's words belong to the key in force — "A to Z" means nothing
   * about a list of release dates — so they are rewritten whenever either
   * changes, and the button says what the order is rather than what pressing
   * it would do.
   */
  function setSort(key, next) {
    sortKey = key;
    descending = next;

    menu?.set(sortKey);

    const words = (SORTS[sortKey] || SORTS.title).labels[descending ? 1 : 0];
    direction?.classList.toggle("is-descending", descending);
    direction?.setAttribute("aria-label", `Ordered ${words}. Press to reverse.`);
    if (directionLabel) directionLabel.textContent = words;

    apply();
  }

  direction?.addEventListener("click", () => setSort(sortKey, !descending));

  reset?.addEventListener("click", () => {
    for (const range of Object.values(ranges)) range.reset();
    publisher = "";
    publisherMenu?.set(publisher);
    apply();
  });

  /*
   * The tray is a disclosure rather than an overlay: it pushes the grid down
   * instead of covering it, so what you are filtering stays in view while you
   * filter it. Opening it moves focus nowhere — the reader pressed a button
   * beside the thing that appeared, and they are already looking at it.
   */
  function setOpen(open) {
    tools.hidden = !open;
    toggle?.setAttribute("aria-expanded", String(open));
  }

  toggle?.addEventListener("click", () => {
    setOpen(toggle.getAttribute("aria-expanded") !== "true");
  });

  toggle?.removeAttribute("hidden");
  setOpen(false);
  publisherMenu?.set(publisher);
  setSort("title", SORTS.title.descending);
}
