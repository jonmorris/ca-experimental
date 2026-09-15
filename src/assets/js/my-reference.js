import { bookmarkStore } from "./bookmark-store.js";
import { referenceOrderStore } from "./reference-order.js";
import { refreshSections } from "./section-tracker.js";
import { decodeShare, encodeShare, shareUrl } from "./reference-share.js";

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

/*
 * An arrow, and not the box-with-an-arrow that marks a link leaving a site.
 *
 * That icon is two shapes — a frame and an arrow escaping it — and this is the
 * smallest place on the site anything is drawn. At twelve pixels the frame
 * closed up into a blob with a nick out of one corner and the arrow inside it
 * had nowhere to go: the same drawing at eighteen, in the downloads list, is
 * perfectly clear. Fewer strokes is the fix that survives the size rather than
 * arguing with it, and an arrow leaving towards the top right says "it lives
 * over there" without the frame's help.
 */
const SOURCE_ICON = `<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" focusable="false">
  <path d="M5 11 11 5M6.5 5H11v4.5"
        fill="none" stroke="currentColor" stroke-width="1.75"
        stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const MOVE_ICON = `<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" focusable="false">
  <path d="M8 13V3M4 7l4-4 4 4" fill="none" stroke="currentColor" stroke-width="1.7"
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
    for (const section of doc.sections) {
      const key = `${doc.expansion}::${doc.slug}::${section.slug}`;
      const bookmark = wanted.get(key);
      if (!bookmark) continue;
      wanted.delete(key);
      entries.push({ key, doc, anchor: section.slug, title: bookmark.title, bookmark });
    }
  }

  return { entries, orphans: [...wanted.values()] };
}

/**
 * The reader's own order, laid over the rules'.
 *
 * Sparse on purpose, in both directions. A stored key whose section is no
 * longer bookmarked is skipped rather than treated as a gap, and a bookmark
 * made since the ordering goes on the end — where the reader can see it arrive,
 * rather than slotted into the rules position it would have had, which is a
 * place nobody watching the page would think to look.
 *
 * So removing a bookmark and adding it again puts it at the end. That is the
 * honest reading of "new bookmarks go last", and the alternative — remembering
 * a position for a section that is not here — is a rule that only makes sense
 * from inside the code.
 */
function applyStoredOrder(entries, keys) {
  if (!keys?.length) return entries;

  const byKey = new Map(entries.map((entry) => [entry.key, entry]));
  const ordered = [];
  for (const key of keys) {
    const entry = byKey.get(key);
    if (!entry) continue;
    byKey.delete(key);
    ordered.push(entry);
  }

  // Whatever the stored order has never seen, in rules order, at the end.
  return [...ordered, ...byKey.values()];
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

  /*
   * Up and down rather than a drag handle.
   *
   * A drag is the obvious affordance and the wrong one to build first: it is
   * most of the work, it is the part that fails by thumb, and it needs a
   * keyboard equivalent written anyway — which is this. Two buttons work on a
   * phone on the first try, need no library, and are announced properly. A
   * drag can be layered onto these rows later without touching the store.
   */
  for (const direction of ["up", "down"]) {
    const move = document.createElement("button");
    move.type = "button";
    move.className = `reference-move reference-move--${direction}`;
    move.dataset.referenceMove = direction;
    move.innerHTML = MOVE_ICON;
    tools.append(move);
  }

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

/**
 * The sections a link named, in the order it named them.
 *
 * Built by looking every key up in the page's own document list, so the link
 * contributes the choice and the sequence and nothing else — every title and
 * every URL comes from the build. A key naming a section these rules no longer
 * have finds nothing and is counted as missing rather than rendered as a gap.
 */
function planShared(order, keys) {
  const byKey = new Map();
  for (const doc of order) {
    for (const section of doc.sections) {
      byKey.set(`${doc.expansion}::${doc.slug}::${section.slug}`, { doc, section });
    }
  }

  const entries = [];
  let missing = 0;
  for (const key of keys) {
    const found = byKey.get(key);
    if (!found) {
      missing += 1;
      continue;
    }
    entries.push({
      key,
      doc: found.doc,
      anchor: found.section.slug,
      title: found.section.title,
      /*
       * The record this section would be saved as. Built here rather than at
       * the moment somebody presses Save, so that what the page is showing and
       * what it would write are the same object.
       */
      bookmark: {
        gameSlug: document.body.dataset.game,
        gameTitle: document.body.dataset.gameTitle || document.body.dataset.game,
        expansionSlug: found.doc.expansion || "",
        expansionTitle: found.doc.expansionLabel || "",
        ruleSlug: found.doc.slug,
        ruleTitle: found.doc.label,
        ruleUrl: found.doc.url,
        anchor: found.section.slug,
        title: found.section.title,
        url: `${found.doc.url}#${found.section.slug}`,
      },
    });
  }

  return { entries, missing };
}

/**
 * Somebody else's reference, on this reader's screen.
 *
 * Nothing is written by arriving. A link is a navigation, and a navigation that
 * quietly edits the reader's own saved things is the kind of surprise that
 * makes a site untrustworthy — so the page shows what was shared, says whose it
 * is, and waits to be asked.
 *
 * Saving merges: the store keeps what it has and adds what it lacks, so a
 * reader who already had four of these eight keeps their four exactly as they
 * were. The other four land at the end, in the order the link listed them,
 * which is the same rule any new bookmark follows.
 */
function initSharedBanner({ root, gameSlug, entries, missing, ownKeys }) {
  const banner = root.querySelector("[data-shared-banner]");
  if (!banner) return;

  const count = banner.querySelector("[data-shared-count]");
  const note = banner.querySelector("[data-shared-missing]");
  const save = banner.querySelector("[data-shared-save]");

  banner.hidden = false;

  /*
   * A link that names nothing this game still has. Rare, and the one case where
   * the banner is the whole answer — there is no reference under it to read, so
   * it says what happened rather than counting to zero.
   */
  if (!entries.length) {
    const lead = banner.querySelector(".shared-banner__lead");
    if (lead) {
      lead.innerHTML =
        "<strong>That shared reference is out of date.</strong> None of the sections in the link are in these rules any more.";
    }
    if (save) save.hidden = true;
    return;
  }

  if (count) {
    count.textContent = `${entries.length} section${entries.length === 1 ? "" : "s"}`;
  }
  if (note) {
    note.hidden = missing === 0;
    note.textContent =
      missing === 0
        ? ""
        : ` ${missing} more ${missing === 1 ? "is" : "are"} no longer in these rules.`;
  }

  save?.addEventListener("click", () => {
    for (const entry of entries) bookmarkStore.add(entry.bookmark);

    /*
     * And the arrangement with them.
     *
     * Saving the sections without the sequence would throw away half of what
     * was shared: somebody who ordered eight sections for their group ordered
     * them for a reason, and dropping the new ones into rules order loses it.
     * So what the reader already had keeps its position, and everything new
     * lands after it in the order the link listed — which is the same rule any
     * new bookmark follows, applied to four at once.
     */
    const keys = [...ownKeys];
    for (const entry of entries) {
      if (!keys.includes(entry.key)) keys.push(entry.key);
    }
    referenceOrderStore.set(gameSlug, keys);

    /*
     * And then the page as their own, which is now the same sections plus
     * whatever they already had. A reload rather than a re-render: this happens
     * once, and the page that builds a reference from scratch is the one that
     * has always been right about what a reference is.
     */
    window.location.replace(window.location.pathname);
  });
}

/**
 * Handing this reference to somebody else.
 *
 * The link is built from the page as it stands — the sections in it and the
 * order they are in — rather than from the store, because what somebody means
 * by "share this" is the thing in front of them.
 */
function initShare({ root, body }) {
  const button = root.querySelector("[data-reference-share]");
  if (!button) return;

  const sections = () => [...body.querySelectorAll(".reference-section[data-ref-key]")];
  if (!sections().length) return;
  button.hidden = false;

  const label = button.textContent;
  let timer;

  button.addEventListener("click", async () => {
    const url = shareUrl(sections().map((section) => section.dataset.refKey));
    if (!url) return;

    let copied = false;
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(url);
        copied = true;
      } catch {
        copied = false;
      }
    }

    /*
     * No clipboard, no dead end: the link goes in the address bar, which is
     * somewhere it can be copied by hand. The same fallback the heading
     * permalinks use, and for the same reason.
     */
    if (!copied) {
      window.location.hash = url.split("#")[1] || "";
      return;
    }

    button.textContent = "Link copied";
    clearTimeout(timer);
    timer = setTimeout(() => {
      button.textContent = label;
    }, 2000);
  });
}

/**
 * Reorder mode.
 *
 * The page collapses to its own headings, which is the table of contents this
 * page would otherwise need a second copy of: what you move is the section, in
 * the list it is actually in, and the thing you are arranging is the thing you
 * are looking at. Nothing is fetched to apply a move — every section is already
 * in the document with its body filled, so an order is `append` called a few
 * times, and one `refreshSections()` hands the new sequence to the sidebar, the
 * jump sheet and the pager.
 *
 * Removal is deliberately not available here. Reordering and deleting are two
 * different intentions and a row carrying both invites the wrong one; removal
 * already has its own tap, and an undo on it.
 */
function initReorder({ root, body, gameSlug, rulesOrder }) {
  const tools = root.querySelector("[data-reference-tools]");
  const toggle = tools?.querySelector("[data-reorder-toggle]");
  const reset = tools?.querySelector("[data-reorder-reset]");
  const status = tools?.querySelector("[data-reorder-status]");
  if (!tools || !toggle) return;

  const movable = () => [...body.querySelectorAll(".reference-section[data-ref-key]")];

  // One section is an order already. Two is the first that can be wrong.
  if (movable().length < 2) return;
  tools.hidden = false;

  function say(message) {
    if (status) status.textContent = message;
  }

  /* The page's own order, as the page currently has it. */
  function persist() {
    referenceOrderStore.set(gameSlug, movable().map((section) => section.dataset.refKey));
    if (reset) reset.hidden = false;
  }

  function setReordering(on) {
    root.dataset.reordering = on ? "on" : "off";
    toggle.setAttribute("aria-pressed", String(on));
    toggle.textContent = on ? "Done" : "Reorder";
    if (reset) reset.hidden = !on || !referenceOrderStore.has(gameSlug);
    say(on ? "Reordering. Move each section with the arrows beside its name." : "");
  }

  body.addEventListener("click", (event) => {
    const button = event.target.closest("[data-reference-move]");
    if (!button) return;

    const section = button.closest(".reference-section");
    const sections = movable();
    const index = sections.indexOf(section);
    const next = button.dataset.referenceMove === "up" ? index - 1 : index + 1;
    if (index < 0 || next < 0 || next >= sections.length) return;

    /*
     * `before` and `after` rather than a swap: a swap of two adjacent nodes is
     * the same move written twice, and this reads as what the reader asked for.
     */
    if (next < index) sections[next].before(section);
    else sections[next].after(section);

    persist();
    // The lists that navigate this page are built from its headings.
    refreshSections();

    // The node moved, and focus went with it — but a button that has just been
    // pressed four times in a row should still be under the finger.
    button.focus();
    say(`${section.querySelector("h2")?.textContent.trim()}, ${next + 1} of ${sections.length}`);
  });

  toggle.addEventListener("click", () => {
    setReordering(toggle.getAttribute("aria-pressed") !== "true");
  });

  reset?.addEventListener("click", () => {
    referenceOrderStore.reset(gameSlug);

    /*
     * Back to the build's order, which is the order `plan()` produced before
     * anything stored was laid over it. Re-appending in that sequence leaves
     * anything it does not name — an orphan — where it already was, at the end.
     */
    const byKey = new Map(movable().map((section) => [section.dataset.refKey, section]));
    for (const key of rulesOrder) {
      const section = byKey.get(key);
      if (section) body.append(section);
    }

    /*
     * And the orphans back behind them. Appending every section in turn walks
     * the whole list to the end of the page, so a bookmark whose section the
     * rules no longer have — which is never in `rulesOrder` — would otherwise
     * be left in front of the reference rather than after it.
     */
    for (const missing of body.querySelectorAll(".reference-section--missing")) {
      body.append(missing);
    }

    refreshSections();
    reset.hidden = true;
    say("Back in rules order.");
  });

  setReordering(false);
}

export function initMyReference() {
  const root = document.querySelector("[data-my-reference]");
  const body = root?.querySelector("[data-reference-body]");
  const empty = root?.querySelector("[data-reference-empty]");
  const gameSlug = document.body.dataset.game;
  if (!root || !body || !empty || !gameSlug) return;

  const order = readOrder();

  /*
   * Whose reference this is, decided before anything is drawn.
   *
   * A link that names sections is somebody else's curation and is rendered as
   * such — read-only, labelled, and saved only if the reader asks. Everything
   * below builds sections the same way either way; what changes is where the
   * list came from and what the page says about it.
   */
  const sharedKeys = decodeShare(window.location.hash);
  const shared = sharedKeys ? planShared(order, sharedKeys) : null;

  /*
   * A share that arrives without a navigation still has to be honoured.
   *
   * The page reads the fragment once, at load, which covers the ordinary way a
   * shared link is opened. Pasting one into the address bar while already on
   * this page changes the fragment without reloading the document, and the
   * reader would be left looking at their own reference wondering what the link
   * did. Reloading is the whole answer: the page builds itself from the
   * fragment, so building it again is building the right one.
   */
  const sharedSignature = encodeShare(sharedKeys || []);
  window.addEventListener("hashchange", () => {
    if (encodeShare(decodeShare(window.location.hash) || []) !== sharedSignature) {
      window.location.reload();
    }
  });

  const planned = plan(order, bookmarkStore.list({ gameSlug }));
  const orphans = shared ? [] : planned.orphans;
  const entries = shared
    ? shared.entries
    : applyStoredOrder(planned.entries, referenceOrderStore.get(gameSlug));

  if (!entries.length && !orphans.length && !shared) return; // the empty state is right

  empty.hidden = true;
  body.hidden = false;
  if (shared) root.dataset.shared = "on";

  // Pass one: everything the page can know without asking the network.
  const sections = new Map();
  body.replaceChildren();
  for (const entry of entries) {
    const section = buildSection(entry);
    sections.set(section.dataset.refKey, { entry, section });
    body.append(section);
  }
  for (const orphan of orphans) body.append(buildOrphan(orphan));

  if (shared) {
    /* What this reader already has, in the order they already have it. */
    const ownKeys = applyStoredOrder(
      planned.entries,
      referenceOrderStore.get(gameSlug),
    ).map((entry) => entry.key);

    initSharedBanner({ root, gameSlug, entries, missing: shared.missing, ownKeys });
  } else {
    /* The rules' own order, kept so "Reset to rules order" has somewhere to go. */
    const rulesOrder = planned.entries.map((entry) => entry.key);
    initReorder({ root, body, gameSlug, rulesOrder });
    initShare({ root, body });
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
    if (!button || shared) return;

    const section = button.closest(".reference-section");
    const record = sections.get(section?.dataset.refKey);
    if (!record) return;

    bookmarkStore.remove(record.entry.bookmark);
    section.classList.add("is-removed");
    button.remove();

    const undo = document.createElement("p");
    undo.className = "reference-removed";
    undo.innerHTML = `Removed from My Reference. <button type="button" class="reference-removed__undo">Undo</button>`;
    undo.querySelector("button").addEventListener("click", () => {
      bookmarkStore.add(record.entry.bookmark);
      section.classList.remove("is-removed");
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
