/**
 * Holding a shelf row to one line, with a way to see the rest.
 *
 * Favourites and recent games are answers to "what do I want right now", and
 * the point of them is being above the shelf rather than being the whole of it.
 * A reader with nineteen favourites had two screens of their own games between
 * them and everything else — the row stopped being a shortcut and became a
 * second catalogue.
 *
 * So the row shows what fits across once, and the last place in it goes to a
 * card that opens the rest in place. Nothing is hidden behind a page, nothing
 * moves anywhere, and the reader who wanted the shortcut gets the shortcut.
 *
 * How many fit is read from the grid rather than assumed: the track count comes
 * from the resolved `grid-template-columns`, so it follows the breakpoints and
 * the reader's own text size without either being restated here. It is read
 * again when the window changes size.
 */

/** The resolved number of columns in a CSS grid. */
function columnCount(list) {
  const columns = getComputedStyle(list).gridTemplateColumns;
  if (!columns || columns === "none") return 1;
  return columns.split(" ").filter(Boolean).length;
}

/**
 * Collapses `list` to a single row.
 *
 * Call it after rendering; call it again when the contents change. The tiles
 * stay in the DOM — hidden rather than removed — so expanding is a flag rather
 * than a re-render, and the art never reloads.
 */
export function collapseToRow(list, { label = "See all" } = {}) {
  if (!list) return;

  let expanded = list.dataset.rowExpanded === "true";

  function apply() {
    list.querySelector("[data-row-more]")?.closest("li")?.remove();

    const tiles = [...list.children];
    if (!tiles.length) return;

    const columns = columnCount(list);
    for (const tile of tiles) tile.hidden = false;

    if (expanded || tiles.length <= columns) return;

    /*
     * Where the opener goes depends on how many places there are.
     *
     * Three columns or more, it takes the last one and the row stays a row —
     * which is the shape this was asked for. On a narrow grid that trade is a
     * bad one: with two columns it would leave a single game beside it, and
     * with one it would leave none at all, which is a row of nothing offering
     * to show you everything. So below three it becomes a bar under a full
     * row instead, and the reader still sees games.
     */
    const inRow = columns >= 3;
    const shown = inRow ? columns - 1 : columns;
    for (let i = shown; i < tiles.length; i += 1) tiles[i].hidden = true;

    const item = document.createElement("li");
    item.className = inRow ? "game-tile game-tile--more" : "game-tile--more-bar";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "game-tile__more";
    button.dataset.rowMore = "";
    button.innerHTML =
      `<span class="game-tile__more-count">+${tiles.length - shown}</span>` +
      `<span class="game-tile__more-label"></span>`;
    button.querySelector(".game-tile__more-label").textContent = label;
    button.addEventListener("click", () => {
      expanded = true;
      list.dataset.rowExpanded = "true";
      apply();
    });
    item.append(button);
    list.append(item);
  }

  apply();

  /*
   * A wider window fits more across, which changes both how many belong in the
   * row and what the opener should say. Re-measuring is cheap and the answer
   * is only ever read from the grid.
   */
  if (typeof ResizeObserver === "function") {
    new ResizeObserver(() => apply()).observe(list);
  }

  return apply;
}
