/**
 * Prev / Rulebook TOC / Next.
 *
 * A rulebook is one page of H2 sections, so "prev" and "next" mean the
 * sections either side of the one currently being read. All three controls on
 * the page — inline above and below the content, and the bar pinned to the
 * viewport bottom below 1024px — are driven from here, so they always agree.
 *
 * Server-rendered targets (first and last section) stand in until this runs.
 */

export function initRulebookNav() {
  const controls = [...document.querySelectorAll("[data-rulebook-nav]")];
  if (!controls.length) return;

  const headings = [...document.querySelectorAll(".section-heading h2[id]")];
  if (headings.length < 2) return;

  const sections = headings.map((heading) => ({
    id: heading.id,
    title: heading.textContent.trim(),
    element: heading.closest(".section-heading") || heading,
  }));

  const base = controls[0].dataset.rulebookBase || window.location.pathname;
  let currentIndex = 0;

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

  function render() {
    const prev = sections[currentIndex - 1];
    const next = sections[currentIndex + 1];

    for (const control of controls) {
      setLink(
        control.querySelector("[data-rulebook-prev]"),
        control.querySelector("[data-rulebook-prev-label]"),
        prev,
      );
      setLink(
        control.querySelector("[data-rulebook-next]"),
        control.querySelector("[data-rulebook-next-label]"),
        next,
      );
    }
  }

  /**
   * The current section is the last one whose heading has passed the top of
   * the reading area. Recomputed from scroll position rather than from
   * IntersectionObserver entries, which get confusing with short sections.
   */
  function updateCurrent() {
    const offset = 96;
    let index = 0;
    for (let i = 0; i < sections.length; i += 1) {
      if (sections[i].element.getBoundingClientRect().top - offset <= 0) index = i;
      else break;
    }
    if (index === currentIndex) return;
    currentIndex = index;
    render();
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      updateCurrent();
    });
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });

  updateCurrent();
  render();
}
