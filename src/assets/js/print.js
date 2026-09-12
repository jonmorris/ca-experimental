/**
 * The print button.
 *
 * Server-rendered but shipped `hidden`, like every other control here: without
 * scripting it would be a button that does nothing, and the browser's own print
 * command is right there.
 */
export function initPrint() {
  for (const button of document.querySelectorAll("[data-print]")) {
    button.hidden = false;
    button.addEventListener("click", () => window.print());
  }
}
