/**
 * "Copy link" beside every section heading.
 *
 * The control ships as a plain anchor pointing at the section, so with no
 * script — or no clipboard — following it moves there and leaves the URL in the
 * address bar, which is the same job done by hand. This upgrades it to put that
 * URL straight on the clipboard and say so.
 *
 * The copied URL is absolute. A link to a rule is something you paste into a
 * message to the person across the table, and `#mergers` on its own is no use
 * to them.
 */

const FEEDBACK_MS = 1600;

/** Clipboard access is permission-gated and absent on insecure origins. */
async function copy(text) {
  if (!navigator.clipboard?.writeText) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function initHeadingLinks() {
  const links = [...document.querySelectorAll("[data-copy-link]")];
  if (!links.length) return;

  for (const link of links) {
    const label = link.querySelector(".heading-permalink__label");
    const describe = link.getAttribute("aria-label");
    let timer;

    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href");
      /*
       * Resolved against this page rather than pasted onto it. Beside a heading
       * the href is a bare `#anchor` and the two are the same thing, but the
       * About page points one of these at a section in another document — and
       * concatenating produced `/about//games/indonesia/rulebook/#mergers`, a
       * copied link that went nowhere.
       */
      const url = new URL(href, window.location.href).href;
      const samePage = !href.startsWith("#") ? false : true;

      /*
       * Synchronously, before anything is awaited. A handler that calls this
       * after its first `await` has already lost: the browser has processed
       * the default action by then and followed the link, which scrolls the
       * heading to the top of the window and reads as the page moving on its
       * own the moment you press copy.
       */
      event.preventDefault();

      copy(url).then((copied) => {
        if (!copied) {
          // No clipboard. Do what the anchor would have done, so the reader
          // still gets the URL — in the address bar rather than the clipboard.
          window.location.href = url;
          return;
        }

        /*
         * Put the anchor in the address bar too, since that is what was
         * copied. `replaceState` rather than a navigation: the reader is
         * already at this heading and does not need moving.
         */
        // Only when the link points into this page. Rewriting the address bar
        // to somewhere the reader is not would be a lie about where they are.
        if (samePage) window.history.replaceState(null, "", url);

        link.dataset.copied = "true";
        if (label) label.textContent = "Copied";
        // The accessible name carries the confirmation too; the icon and the
        // label are both invisible to a screen reader.
        link.setAttribute("aria-label", "Link copied");

        clearTimeout(timer);
        timer = setTimeout(() => {
          delete link.dataset.copied;
          if (label) label.textContent = "Copy link";
          link.setAttribute("aria-label", describe);
        }, FEEDBACK_MS);
      });
    });
  }
}
