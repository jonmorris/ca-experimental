import { allGlossaryTerms, buildGames } from "../../lib/registry.js";

/** Flat list of every glossary term in every game — paginated into term pages. */
export default function () {
  return allGlossaryTerms(buildGames());
}
