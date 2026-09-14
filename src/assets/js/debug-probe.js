/**
 * Temporary. A readout of where the pinned pager actually is, on the page it
 * is actually wrong on.
 *
 * Off unless the URL carries `?probe`, so it never reaches a reader. Delete
 * this file, its import in `site.js`, and `.debug-probe` in `components.css`
 * once the iOS bottom-bar question is settled.
 *
 * Every number here is one that a fix would be derived from, and the last two
 * are the ones no amount of reading the stylesheet can answer: whether the bar
 * is pinned to the viewport or to some ancestor that quietly became its
 * containing block, and where its bottom edge lands once it is.
 */
export function initDebugProbe() {
  if (!/[?&]probe\b/.test(window.location.search)) return;

  const root = document.documentElement;
  const viewport = window.visualViewport || null;

  const panel = document.createElement("div");
  panel.className = "debug-probe";
  document.body.append(panel);

  // A hidden ruler, so the page can say what 100dvh currently resolves to.
  const ruler = document.createElement("div");
  ruler.style.cssText = "position:absolute;top:0;left:0;width:1px;height:100dvh;visibility:hidden;pointer-events:none";
  document.body.append(ruler);

  const round = (n) => Math.round(n * 10) / 10;

  function read() {
    const bar = document.querySelector(".prev-next");
    const box = bar ? bar.getBoundingClientRect() : null;
    const style = bar ? getComputedStyle(bar) : null;

    return [
      ["innerHeight", window.innerHeight],
      ["clientHeight", root.clientHeight],
      ["visualVP h", viewport ? round(viewport.height) : "—"],
      ["visualVP top", viewport ? round(viewport.offsetTop) : "—"],
      ["100dvh", ruler.offsetHeight],
      ["scrollTop", Math.round(window.scrollY)],
      ["bar found", bar ? "yes" : "NO"],
      ["bar position", style ? style.position : "—"],
      ["bar display", style ? style.display : "—"],
      ["bar translate", style ? style.translate : "—"],
      ["bar top", box ? round(box.top) : "—"],
      ["bar bottom", box ? round(box.bottom) : "—"],
      ["bar height", box ? round(box.height) : "—"],
      // null means the viewport is its containing block, which is what a
      // fixed element normally wants. A name here means an ancestor took
      // over — a transform, a filter, a `contain` — and `bottom: 0` is being
      // measured against that instead of against the screen.
      ["offsetParent", bar && bar.offsetParent
        ? `${bar.offsetParent.tagName.toLowerCase()}.${bar.offsetParent.className}`.slice(0, 28)
        : "null (good)"],
      ["body padBottom", getComputedStyle(document.body).paddingBottom],
    ];
  }

  function render() {
    panel.replaceChildren(
      ...read().map(([label, value]) => {
        const row = document.createElement("div");
        const key = document.createElement("span");
        key.textContent = label;
        const val = document.createElement("b");
        val.textContent = String(value);
        row.append(key, val);
        return row;
      }),
    );
  }

  let ticking = false;
  function schedule() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      render();
    });
  }

  render();
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  viewport?.addEventListener("resize", schedule);
  viewport?.addEventListener("scroll", schedule);
}
