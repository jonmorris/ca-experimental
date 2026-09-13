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

const DIRECTION_LABELS = {
  title: ["A to Z", "Z to A"],
  year: ["Oldest first", "Newest first"],
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

export function initShelf() {
  const tools = document.querySelector("[data-shelf-tools]");
  const list = document.querySelector("[data-shelf-list]");
  if (!tools || !list) return;

  const tiles = [...list.querySelectorAll(".game-tile")].map(readTile);
  if (!tiles.length) return;

  const sort = tools.querySelector("[data-shelf-sort]");
  const direction = tools.querySelector("[data-shelf-direction]");
  const directionLabel = tools.querySelector("[data-shelf-direction-label]");
  const reset = tools.querySelector("[data-shelf-reset]");
  const count = document.querySelector("[data-shelf-count]");
  const empty = document.querySelector("[data-shelf-empty]");

  let descending = false;

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
    return true;
  }

  function compare(a, b) {
    const key = sort?.value || "title";
    if (key === "year") {
      // A game with no year sorts to the end, whichever way the list is facing.
      if (a.year === null || b.year === null) {
        if (a.year === b.year) return a.title.localeCompare(b.title);
        return a.year === null ? 1 : -1;
      }
      if (a.year !== b.year) return a.year - b.year;
      return a.title.localeCompare(b.title);
    }
    return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
  }

  function apply() {
    const shown = tiles.filter(matches);
    shown.sort((a, b) => {
      const order = compare(a, b);
      // Titles never invert: a Z-to-A list of a tie is still alphabetical.
      return descending && !(a.year === null || b.year === null) ? -order : order;
    });

    for (const tile of tiles) tile.el.hidden = true;
    for (const tile of shown) {
      tile.el.hidden = false;
      list.append(tile.el);
    }

    if (count) count.textContent = String(shown.length);
    if (empty) empty.hidden = shown.length > 0;

    const filtered = Object.values(ranges).some((range) => !range.isDefault);
    if (reset) reset.hidden = !filtered;
  }

  function setDirection(next) {
    descending = next;
    direction?.setAttribute("aria-pressed", String(descending));
    direction?.classList.toggle("is-descending", descending);
    if (directionLabel) {
      const [up, down] = DIRECTION_LABELS[sort?.value || "title"] || DIRECTION_LABELS.title;
      directionLabel.textContent = descending ? down : up;
    }
    apply();
  }

  sort?.addEventListener("change", () => setDirection(descending));
  direction?.addEventListener("click", () => setDirection(!descending));
  reset?.addEventListener("click", () => {
    for (const range of Object.values(ranges)) range.reset();
    apply();
  });

  tools.hidden = false;
  setDirection(false);
}
