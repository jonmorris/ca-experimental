/**
 * Repairs a document title that a badge got appended to.
 *
 * For a short while the page heading carried the Official mark as a sibling of
 * the name, and everything that recorded which document a reader was in took
 * that heading's `textContent` — so bookmarks and history written in that
 * window stored "RulebookOfficial". The source is fixed; this is for the
 * records already in people's browsers, which nothing else will ever correct.
 *
 * The discriminator is the missing space. The mark was emitted hard against
 * the name with no whitespace between them, so the corruption always ends in
 * "Official" preceded by a letter. A real title that ends in the word has a
 * space before it — and a real title that *starts* with it is untouched, which
 * matters here more than it sounds: Arcs' FAQ is called "Official FAQ", and a
 * rule that simply removed the word would rename it. A record written in the
 * bad window reads "Official FAQOfficial", and only the appended one goes.
 *
 * Deliberately not a schema bump. The shape did not change and no reader needs
 * to know this happened; a record that was never wrong passes through
 * untouched, and one that was is right from the next read onward.
 */

const APPENDED = /(?<=\S)Official$/;

export function repairTitle(title) {
  const value = String(title ?? "");
  const fixed = value.replace(APPENDED, "");
  // Never leave nothing behind: a document actually called "Official" keeps
  // its name rather than losing it to this.
  return fixed.trim() ? fixed : value;
}

/** Applies it to the one field that could have caught the badge. */
export function repairRecord(record) {
  if (!record || typeof record !== "object") return record;
  const ruleTitle = repairTitle(record.ruleTitle);
  return ruleTitle === record.ruleTitle ? record : { ...record, ruleTitle };
}
