#!/usr/bin/env node
/**
 * Validates every game's `bgg_id` against Geekdo.
 *
 * An ID is valid only when all three hold:
 *
 *   1. The item exists.
 *   2. Its `subtype` is `boardgame` — not an expansion, accessory or video game.
 *   3. Its canonical `href` starts with `/boardgame/{id}/`, so the ID has not
 *      been silently redirected to a different item.
 *
 * Usage:
 *   npm run verify:bgg           report problems, exit 1 only on a real mismatch
 *   npm run verify:bgg:strict    also fail on network errors
 *
 * Strict mode is what CI runs: a network error there means the check did not
 * actually happen, and an unverified ID must not pass as a verified one.
 */

import { buildGames } from "../lib/registry.js";

// Overridable so the check can be pointed at a mock in tests.
const GEEKDO_API = process.env.BGG_API || "https://api.geekdo.com/api/geekitems";
const REQUEST_TIMEOUT_MS = 15000;
const RETRIES = 2;
const RETRY_DELAY_MS = 1000;

const strict = process.argv.includes("--strict");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** One Geekdo lookup, with a timeout and a couple of retries. */
async function fetchItem(id) {
  const url = `${GEEKDO_API}?objectid=${encodeURIComponent(id)}&objecttype=thing`;
  let lastError;

  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    if (attempt > 0) await sleep(RETRY_DELAY_MS * attempt);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { accept: "application/json" },
      });
      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status}`);
        // A 404 is an answer, not a transport failure — do not retry it.
        if (response.status === 404) return { ok: true, item: null };
        continue;
      }
      const body = await response.json();
      return { ok: true, item: body?.item ?? null };
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
  }

  return { ok: false, error: lastError };
}

export function validate(id, item) {
  if (!item) return { valid: false, reason: "no such item on BoardGameGeek" };

  const subtype = String(item.subtype || "");
  if (subtype !== "boardgame") {
    return { valid: false, reason: `subtype is "${subtype}", expected "boardgame"` };
  }

  const href = String(item.href || "");
  const expected = `/boardgame/${id}/`;
  if (!href.startsWith(expected)) {
    return { valid: false, reason: `canonical href is "${href}", expected it to start with "${expected}"` };
  }

  return { valid: true, name: item.name || item.href };
}

async function main() {
  const games = Object.values(buildGames());
  if (!games.length) {
    console.error("No games found under src/games/.");
    process.exit(1);
  }

  const problems = [];
  const networkErrors = [];

  for (const game of games) {
    const id = game.meta.bgg_id;

    if (!id || !Number.isInteger(Number(id))) {
      problems.push(`${game.slug}: missing or non-numeric bgg_id (${JSON.stringify(id)})`);
      console.log(`✗ ${game.slug} — missing or non-numeric bgg_id`);
      continue;
    }

    const result = await fetchItem(id);

    if (!result.ok) {
      const message = `${game.slug} (#${id}): could not reach Geekdo — ${result.error?.message || result.error}`;
      networkErrors.push(message);
      console.log(`? ${game.slug} — ${result.error?.message || "network error"} (not verified)`);
      continue;
    }

    const check = validate(id, result.item);
    if (check.valid) {
      console.log(`✓ ${game.slug} — #${id} ${check.name}`);
    } else {
      problems.push(`${game.slug} (#${id}): ${check.reason}`);
      console.log(`✗ ${game.slug} — ${check.reason}`);
    }
  }

  console.log(
    `\n${games.length} game${games.length === 1 ? "" : "s"} checked · ` +
      `${problems.length} invalid · ${networkErrors.length} unverified`,
  );

  if (problems.length) {
    console.error("\nInvalid BGG IDs:");
    for (const problem of problems) console.error(`  - ${problem}`);
  }

  if (networkErrors.length) {
    console.error("\nCould not verify:");
    for (const error of networkErrors) console.error(`  - ${error}`);
    if (strict) {
      console.error("\nRunning in strict mode — an unverified ID is a failure.");
    }
  }

  const failed = problems.length > 0 || (strict && networkErrors.length > 0);
  process.exit(failed ? 1 : 0);
}

// Importing this module for its `validate` export must not run the check.
if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
