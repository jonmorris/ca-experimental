/**
 * How far the visible screen reaches past the bottom of the page's own
 * coordinate space.
 *
 * iOS Safari collapses its bottom toolbar as you scroll and hands the space to
 * the visual viewport — not to the layout viewport, which is what
 * `position: fixed` is anchored to. So a bar pinned to `bottom: 0` stops where
 * the expanded toolbar's top edge was, and the page carries on underneath it
 * with Safari's floating URL pill over the top. The bar reads as hovering in
 * the middle of the screen rather than sitting on its edge.
 *
 * No CSS length knows about that difference: `dvh` describes the viewport's
 * height, not where a fixed element got pinned, and painting past the edge is
 * no use because the overflow is clipped there too. `visualViewport` is the
 * one thing that can see it, so this measures the gap and publishes it for the
 * stylesheet to move the bar down by.
 *
 * Everywhere else the number is zero and nothing moves.
 */
export function initViewportGap() {
  const viewport = window.visualViewport;
  if (!viewport) return;

  const root = document.documentElement;
  let ticking = false;

  function measure() {
    ticking = false;
    /*
     * Both sides in layout-viewport coordinates: `offsetTop + height` is where
     * the visible area ends, `clientHeight` is where the page believes it
     * ends. Positive means the screen reaches further down than the page does.
     */
    const gap = viewport.offsetTop + viewport.height - root.clientHeight;
    /*
     * Never negative. A shrinking visual viewport is the keyboard, not the
     * toolbar, and hauling the bar up off its own edge is not the answer to
     * that — it would leave a gap at the bottom to close one at the top.
     */
    root.style.setProperty("--viewport-gap", `${Math.max(0, Math.round(gap))}px`);
  }

  function schedule() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(measure);
  }

  measure();
  // The toolbar collapsing is a resize; scrolling it away fires both.
  viewport.addEventListener("resize", schedule);
  viewport.addEventListener("scroll", schedule);
}
