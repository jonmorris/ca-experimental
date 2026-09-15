# Copilot instructions

Repository-wide guidance for generated code and content. `docs/CONVENTIONS.md`
is the authority on the content model, the URL contract, the design system and
the engineering principles. This file carries only the rules a generator has to
apply without being asked.

## Content files carry their state

Every content markdown file under `src/games/` has a state block in its
frontmatter, alongside `title` and the rest:

```yaml
stage: audit          # audit | working | live | update
text: T1              # T0-T4
images: I0            # I0-I4
links: L0             # L0-L4
rights: requested     # n/a | requested | granted | declined
```

When generating or scaffolding a content file, write the block and score it
truthfully for what the file actually contains:

- `stage` is always `audit`. Only a person promotes a file.
- `text` is `T0` for a placeholder, `T1` for unstructured prose, `T2` when the
  H2 sections and shortcodes are in place. Never write `T3` or `T4`.
- `images` is `I0` unless annotations or assets are genuinely present.
- `links` is `L0` until every H2 has a manually set anchor, then `L1`. Never
  write `L3` or `L4`.
- `rights` is `requested` for anything reproduced from a publisher, `n/a` for
  original editorial content written for this site.
- Omit `audited`. An absent date means never audited, which is true of anything
  a generator has just written.

`docs/CONTENT-STATES.md` is the authority on every level, on the
gate a file must clear to be `live`, and on what an external change knocks down.

## Prose

- No em dashes in documentation, commit messages or content written for this
  site.
- Never use the phrase "mobile-first".
