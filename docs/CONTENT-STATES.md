# Content states

Every content file records its own state in its frontmatter. That record is the
only one. There is no spreadsheet, no board, and no second store to fall out of
step with the files.

Two concerns, kept apart:

- **`stage`** is where a file is in its life. One value per file.
- **The four axes** are how ready it is, each measured on its own.

A high axis never promotes a stage, and a stage never implies an axis. A file
can sit at `audit` with good scores because nobody has picked it up, and a file
at `working` can be worse on every axis than one nobody has touched.

---

## The block

```yaml
stage: audit          # audit | working | live | update
text: T1              # T0-T4
images: I0            # I0-I4
links: L0             # L0-L4
rights: requested     # n/a | requested | granted | declined
audited: 2026-09-15   # ISO date, last honest scoring
blocked_by:           # optional, free text, one line per blocker
  - images not extracted yet
```

`stage`, `text`, `images`, `links` and `rights` are required on every content
file. `audited` and `blocked_by` are optional.

**`audited` is the date somebody last read the file and scored it honestly.**
Absent means never audited. That is a true statement and the correct value until
somebody has done it, so leave the field out rather than dating it to make a row
look tidy.

**`blocked_by` is written for the person who will clear the blocker**, not for a
report. One line each, plain language, no codes.

---

## Stage

| Value | Meaning |
| --- | --- |
| `audit` | Scored, not worked. The default for every file. |
| `working` | Actively being raised on at least one axis. |
| `live` | Published, and clears the gate below. |
| `update` | Was live. Something external changed, and the axes have been knocked down to what is now true. |

`update` is not a worse `working`. It records that the file was correct and is
now not, which is the thing a reader would want to know and the thing that gets
lost if it goes back to `working`.

---

## Text

| Level | Meaning |
| --- | --- |
| `T0` | Placeholder. File and frontmatter exist, no real content. |
| `T1` | Raw. Source text present, unstructured, unverified. |
| `T2` | Structured. H2 sections match the rulebook's structure, shortcodes applied, lists and callouts correct. Wording not yet verified. |
| `T3` | Verified. Checked word for word against the official source. Zero open `FIDELITY-FLAG` comments. |
| `T4` | Complete. T3, plus all presentation detail finished and the print output correct. |

A **`FIDELITY-FLAG`** is an HTML comment in the body recording a place where the
source is wrong, ambiguous, or damaged, and has been preserved as found:

```html
<!-- FIDELITY-FLAG: source reads "shiftall" - apparent OCR word merge. Preserved as found. -->
```

Open means still in the body. A flag is closed by resolving the question, not by
deleting the comment.

---

## Images

| Level | Meaning |
| --- | --- |
| `I0` | None. No images, no placeholders. |
| `I1` | Marked. HTML comment annotations at every point a source image belongs. |
| `I2` | Extracted. Raw assets pulled from source, unprocessed. |
| `I3` | Processed. Cropped, optimized, named to convention, in the correct directory. |
| `I4` | Placed. Rendering with alt text, verified in a build. |

---

## Links

| Level | Meaning |
| --- | --- |
| `L0` | None. No stable anchors. |
| `L1` | Anchored. Every H2 has a manually set stable ID. See `docs/CONVENTIONS.md` §3. |
| `L2` | Outbound. Links out placed: terms to the glossary, expansion deltas to the base rules, FAQ entries to the rule they modify. |
| `L3` | Inbound. Everything that should point at this file does. |
| `L4` | Verified. Manifest clean, no broken anchors, confirmed in a build. |

L3 is a claim about other files. It cannot be scored by reading this one.

---

## Rights

| Value | Meaning |
| --- | --- |
| `n/a` | Original editorial content written for this site. |
| `requested` | Permission asked for, no answer yet. |
| `granted` | Permission given. |
| `declined` | Permission refused or withdrawn. |

**A `declined` file can never go live**, whatever its axes say, and it is
excluded from the build output rather than left unlinked.

---

## The gate

A file may be `stage: live` only if all of these hold:

- `text` is T3 or better
- `links` is L2 or better
- `rights` is `granted` or `n/a`
- no open `FIDELITY-FLAG` comments in the body

`images` is unconstrained. The site is text first, and a rulebook with no
pictures is still a rulebook.

The build refuses a `live` file that does not clear the gate. Putting the state
in the repo is only worth doing if the repo enforces it.

---

## Update rules

When an external change lands, knock down only what actually became false.
Never zero a whole file out of caution: a score that is lower than the truth
costs exactly as much work to recover as one that is higher costs in trust.

| What changed | What moves |
| --- | --- |
| Wording changed in a section | `text` back to T2, and that section's images to I1. Links untouched. |
| A new edition | `text` to T1, `images` to I0, `links` to L1. |
| Anchors renamed or sections reordered | `links` back to L1. Text untouched. |
| Permission revoked | `rights` only. |

Set `stage: update` at the same time, and re-date `audited` only if the scoring
that follows was honest work rather than a guess at the damage.

---

## Scoring rules

- **Never guess upward.** When a signal is ambiguous, take the lower level.
- **T3, T4, L3 and L4 are never assigned automatically.** Word for word
  verification and inbound coverage are human acts, and a script cannot observe
  either. A tool may lower them. Only a person may raise them.
- **Score what is observably true in the file**, not what is nearly true, and
  not what will be true by the end of the afternoon.
- **`stage` is promoted by hand.** Nothing generated promotes a file.
