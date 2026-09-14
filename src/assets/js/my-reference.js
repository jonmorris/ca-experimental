import { bookmarkStore } from "./bookmark-store.js";
import { refreshSections } from "./section-tracker.js";

/**
 * My Reference: the reader's own page, assembled from their bookmarks.
 *
 * The build cannot know what is on this page — bookmarks live in the browser —
 * so the page ships empty and fills itself here. It does that in two passes,
 * which is what makes it feel instant:
 *
 *  1. From `data-reference-order` (every document of this game in nav order,
 *     each with its sections in reading order) crossed with the bookmarks, the
 *     page already knows exactly what it contains and in what order. The
 *     headings and the source links render immediately, with no network at
 *     all, and the site's own navigation — sidebar list, sticky bar, jump
 *     sheet, prev/next — fills itself from those headings like any other
 *     page's.
 *  2. Each distinct source document is then fetched once and its sections
 *     lifted out to fill the bodies in.
 *
 * Two rules govern the copies, and between them they settle the anchor problem:
 *
 *  - Every link inside a copied section is rewritten to an absolute URL back to
 *    the document it came from, so nothing on this page links into this page.
 *  - Every id inside a copy is stripped, and the only anchors here are the ones
 *    this page mints for its own headings — prefixed with the document, and
 *    with the expansion where there is one. That last part is not optional:
 *    Arcs' rulebook and The Blighted Reach's rulebook are both `rulebook`, and
 *    both open with an `introduction`.
 */

const SOURCE_ICON = `<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
  <path d="M6 3h7v7M13 3 6.5 9.5M11 9.5V13H3V5h3.5"
        fill="none" stroke="currentColor" stroke-width="1.6"
        stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const BOOKMARK_ICON = `<svg viewBox="0 0 16 20" width="15" height="17" aria-hidden="true" focusable="false">
  <path d="M2.5 1.5h11a1 1 0 0 1 1 1v15.2a.6.6 0 0 1-.94.49L8 14.2l-5.56 4a.6.6 0 0 1-.94-.5V2.5a1 1 0 0 1 1-1Z"
        fill="currentColor" stroke="currentColor" stroke-width="1.6"/>
</svg>`;

/** `the-blighted-reach-rulebook-introduction` — unique on this page by construction. */
function refId(doc, anchor) {
  return [doc.expansion, doc.slug, anchor].filter(Boolean).join("-");
}

/** "Rulebook", or "The Blighted Reach · Rulebook" for an expansion's document. */
function sourceLabel(doc) {
  return doc.expansionLabel ? `${doc.expansionLabel} · ${doc.label}` : doc.label;
}

function readOrder() {
  const node = document.querySelector("[data-reference-order]");
  if (!node) return [];
  try {
    const parsed = JSON.parse(node.textContent || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * The page's contents, in reading order.
 *
 * Driven by the document list rather than by the bookmarks, so the order is the
 * rules' order and not the order things happened to be tapped. A bookmark whose
 * section is no longer in the document falls out of this loop and is collected
 * separately — the rulebook has moved on and the reader should be told, not
 * left with a heading that never fills in.
 */
function plan(order, bookmarks) {
  const wanted = new Map();
  for (const bookmark of bookmarks) {
    wanted.set(`${bookmark.expansionSlug || ""}::${bookmark.ruleSlug}::${bookmark.anchor}`, bookmark);
  }

  const entries = [];
  for (const doc of order) {
    for (const anchor of doc.sections) {
      const key = `${doc.expansion}::${doc.slug}::${anchor}`;
      const bookmark = wanted.get(key);
      if (!bookmark) continue;
      wanted.delete(key);
      entries.push({ doc, anchor, title: bookmark.title, bookmark });
    }
  }

  return { entries, orphans: [...wanted.values()] };
}

function buildSection(entry) {
  const section = document.createElement("section");
  section.className = "reference-section";
  section.dataset.refKey = `${entry.doc.expansion}::${entry.doc.slug}::${entry.anchor}`;

  /*
   * The eyebrow is the link home. It says which document the section came from
   * — which is the whole reason a heading needs context here, since two
   * documents can carry the same heading text — and it is where "take me to
   * this section where it actually lives" belongs. An unlabelled icon could
   * only say "somewhere else".
   */
  const source = document.createElement("p");
  source.className = "reference-source";
  const sourceLink = document.createElement("a");
  sourceLink.href = `${entry.doc.url}#${entry.anchor}`;
  sourceLink.innerHTML = `<span class="reference-source__label"></span>${SOURCE_ICON}`;
  sourceLink.querySelector(".reference-source__label").textContent = sourceLabel(entry.doc);
  sourceLink.setAttribute("aria-label", `Read “${entry.title}” in ${sourceLabel(entry.doc)}`);
  source.append(sourceLink);

  const heading = document.createElement("div");
  heading.className = "section-heading section-heading--bookmarkable";

  const h2 = document.createElement("h2");
  h2.id = refId(entry.doc, entry.anchor);
  h2.textContent = entry.title;

  const tools = document.createElement("span");
  tools.className = "heading-tools";
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "bookmark-toggle is-on";
  remove.dataset.referenceRemove = "";
  remove.setAttribute("aria-pressed", "true");
  remove.setAttribute("aria-label", `Remove “${entry.title}” from My Reference`);
  remove.innerHTML = BOOKMARK_ICON;
  tools.append(remove);

  heading.append(h2, tools);

  const body = document.createElement("div");
  body.className = "reference-section__body";
  body.dataset.referenceSection = "";

  section.append(source, heading, body);
  return section;
}

/** Everything between this section's heading and the next one. */
function extractSection(doc, anchor) {
  const heading = doc.querySelector(`.section-heading h2[id="${CSS.escape(anchor)}"]`);
  if (!heading) return null;

  const start = heading.closest(".section-heading");
  const nodes = [];
  for (let node = start.nextElementSibling; node; node = node.nextElementSibling) {
    if (node.classList.contains("section-heading")) break;
    nodes.push(node.cloneNode(true));
  }
  return nodes;
}

/**
 * Makes a copied fragment safe to sit on a page it did not come from: no ids to
 * collide with anything, and every link pointing back where it was written.
 */
function rehome(nodes, sourceUrl) {
  for (const node of nodes) {
    for (const el of [node, ...node.querySelectorAll("[id]")]) {
      if (el.id) el.removeAttribute("id");
    }
    for (const link of node.querySelectorAll("a[href]")) {
      const href = link.getAttribute("href");
      if (href.startsWith("#")) link.setAttribute("href", `${sourceUrl}${href}`);
    }
    // The source page's own heading controls have no meaning here.
    for (const tools of node.querySelectorAll(".heading-tools")) tools.remove();
  }
  return nodes;
}

/**
 * What is on this page, at the top of it.
 *
 * Every other page states its own shape before the reader starts: a rulebook
 * was written in an order somebody chose, and the nav says so. This one is
 * whatever that reader saved, out of whatever mix of documents they saved it
 * from, and until they scroll there is nothing on the page itself that says
 * what they built. The sidebar answers that on a wide screen, the sticky bar
 * answers it one section at a time, and Just read mode and the printer take
 * both away — none of them is the page.
 *
 * Grouped by source, because the mix is the part a reader cannot guess. Four
 * headings in a row tell you nothing about whether you are looking at the
 * rulebook, the FAQ or an expansion, and on this page those can be adjacent.
 * The group heading is not a link: a contents list whose headings leave the
 * page is not a contents list. Every section already carries its own way back
 * to where it was written.
 *
 * Nothing here is a second source of truth — it is the same `entries` the
 * sections are built from, in the same order, so the list cannot disagree with
 * the page it describes.
 */
function buildContents(entries) {
  const nav = document.createElement("nav");
  nav.className = "reference-contents";
  nav.setAttribute("aria-labelledby", "reference-contents-title");

  const title = document.createElement("h2");
  title.className = "reference-contents__title";
  title.id = "reference-contents-title";
  title.textContent = "Contents";
  nav.append(title);

  /*
   * `plan()` walks the documents in nav order, so entries from one document
   * are already adjacent and a group is a run rather than a bucket to collect
   * into. The same pass that proves the order is the pass that renders it.
   */
  let group = null;
  let list = null;
  for (const entry of entries) {
    const key = `${entry.doc.expansion}::${entry.doc.slug}`;
    if (key !== group) {
      group = key;
      const source = document.createElement("p");
      source.className = "eyebrow reference-contents__source";
      source.textContent = sourceLabel(entry.doc);
      list = document.createElement("ul");
      list.className = "reference-contents__list";
      nav.append(source, list);
    }

    const item = document.createElement("li");
    const link = document.createElement("a");
    link.className = "reference-contents__link";
    link.href = `#${refId(entry.doc, entry.anchor)}`;
    link.textContent = entry.title;
    link.dataset.refKey = `${entry.doc.expansion}::${entry.doc.slug}::${entry.anchor}`;
    item.append(link);
    list.append(item);
  }

  return nav;
}

function buildOrphan(bookmark) {
  const section = document.createElement("section");
  section.className = "reference-section reference-section--missing";
  const heading = document.createElement("div");
  heading.className = "section-heading";
  const h2 = document.createElement("h2");
  h2.textContent = bookmark.title || bookmark.anchor;
  heading.append(h2);
  const note = document.createElement("p");
  note.className = "reference-missing";
  note.textContent = "This section is no longer in the rules. The bookmark can be removed.";
  section.append(heading, note);
  return section;
}

/**
 * The count on the game's contents card.
 *
 * Phrased as the other cards phrase it — "2 sections" — because it is the same
 * question asked of a page whose answer happens to live in the browser. Hidden
 * at zero rather than showing "0 sections": a card that has nothing in it yet
 * is described by its line above, and a zero would read as an error.
 */
export function initReferenceCount() {
  const slot = document.querySelector("[data-reference-count]");
  const gameSlug = document.body.dataset.game;
  if (!slot || !gameSlug) return;

  function render() {
    const saved = bookmarkStore.list({ gameSlug }).length;
    slot.textContent = `${saved} section${saved === 1 ? "" : "s"}`;
    slot.hidden = saved === 0;
  }

  render();
  bookmarkStore.subscribe(render);
}

export function initMyReference() {
  const root = document.querySelector("[data-my-reference]");
  const body = root?.querySelector("[data-reference-body]");
  const empty = root?.querySelector("[data-reference-empty]");
  const gameSlug = document.body.dataset.game;
  if (!root || !body || !empty || !gameSlug) return;

  const order = readOrder();
  const { entries, orphans } = plan(order, bookmarkStore.list({ gameSlug }));

  if (!entries.length && !orphans.length) return; // the empty state is already right

  empty.hidden = true;
  body.hidden = false;

  // Pass one: everything the page can know without asking the network.
  const sections = new Map();
  body.replaceChildren();
  for (const entry of entries) {
    const section = buildSection(entry);
    sections.set(section.dataset.refKey, { entry, section });
    body.append(section);
  }
  for (const orphan of orphans) body.append(buildOrphan(orphan));

  /*
   * The contents list, above everything it lists.
   *
   * Built from `entries` rather than from the headings, so an orphan is left
   * out: a bookmark whose section the rules no longer have is a note about
   * housekeeping, not a part of the reference, and it is the one block on this
   * page a reader cannot go to — it has no anchor because it has no section.
   *
   * Each link keeps the key of the section it points at, so the two stay in
   * step when one is removed.
   */
  if (entries.length) {
    const contents = buildContents(entries);
    body.before(contents);
    for (const link of contents.querySelectorAll("[data-ref-key]")) {
      const record = sections.get(link.dataset.refKey);
      if (record) record.link = link;
    }
  }

  /*
   * The headings exist now, so the rest of the site can see them.
   *
   * This page used to carry its own contents list, built right here, because
   * it was the only thing that knew what was on it. It no longer needs to: one
   * call hands these sections to the tracker, and the sidebar list, the sticky
   * bar, the jump sheet and the prev/next pager fill themselves from it the
   * same way they do on a rulebook. The reader gets the navigation they
   * already know instead of a second kind that only exists here.
   *
   * Before the fetches, not after: the headings are what the navigation is
   * made of, and they are all here. Waiting on the bodies would mean a page
   * with a visible outline and no way to move through it.
   */
  refreshSections();

  /*
   * Removal is undoable. A bookmark is one tap to make and this is one tap to
   * destroy, and the section vanishing under the finger that did it leaves
   * nothing to undo and no sign of what happened. So the store loses it now —
   * the drawer and the jump lists update at once — and the page keeps it until
   * the next load, dimmed, with the way back attached.
   */
  body.addEventListener("click", (event) => {
    const button = event.target.closest("[data-reference-remove]");
    if (!button) return;

    const section = button.closest(".reference-section");
    const record = sections.get(section?.dataset.refKey);
    if (!record) return;

    bookmarkStore.remove(record.entry.bookmark);
    section.classList.add("is-removed");
    // The contents list describes the page, and the page now says this is gone.
    record.link?.classList.add("is-removed");
    button.remove();

    const undo = document.createElement("p");
    undo.className = "reference-removed";
    undo.innerHTML = `Removed from My Reference. <button type="button" class="reference-removed__undo">Undo</button>`;
    undo.querySelector("button").addEventListener("click", () => {
      bookmarkStore.add(record.entry.bookmark);
      section.classList.remove("is-removed");
      record.link?.classList.remove("is-removed");
      undo.remove();
      section.querySelector(".heading-tools").append(button);
    });
    section.querySelector(".section-heading").after(undo);
  });

  // Pass two: one fetch per document, however many sections came from it.
  const documents = new Map();
  for (const { entry } of sections.values()) {
    if (!documents.has(entry.doc.url)) documents.set(entry.doc.url, []);
    documents.get(entry.doc.url).push(entry);
  }

  for (const [url, wanted] of documents) {
    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.text();
      })
      .then((html) => {
        const parsed = new DOMParser().parseFromString(html, "text/html");
        for (const entry of wanted) {
          const key = `${entry.doc.expansion}::${entry.doc.slug}::${entry.anchor}`;
          const target = sections.get(key)?.section.querySelector("[data-reference-section]");
          if (!target) continue;

          const nodes = extractSection(parsed, entry.anchor);
          if (!nodes) {
            target.innerHTML =
              '<p class="reference-missing">This section is no longer in the rules.</p>';
            continue;
          }
          target.replaceChildren(...rehome(nodes, entry.doc.url));
        }
      })
      .catch(() => {
        for (const entry of wanted) {
          const key = `${entry.doc.expansion}::${entry.doc.slug}::${entry.anchor}`;
          const target = sections.get(key)?.section.querySelector("[data-reference-section]");
          if (!target) continue;
          const note = document.createElement("p");
          note.className = "reference-missing";
          note.innerHTML = `This section could not be loaded. <a href="${entry.doc.url}#${entry.anchor}">Read it in ${sourceLabel(entry.doc)}</a>.`;
          target.replaceChildren(note);
        }
      });
  }
}
