// Shared id-assignment logic for glossary cards, used by both assign-ids.mjs
// (existing committed files) and ingest-glossary.mjs (new entries). Scheme:
// `${language}-${slug}[-${n}]`, slug from translit, else prompt, else meaning.

export const slug = (s) =>
  (s || "").toLowerCase().replace(/'/g, "").replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "").slice(0, 40) || "x";

// Stamp ids onto any cards in `cards` missing one, in place. `used` seeds
// from every id already present so ids never collide with existing cards.
// Returns the number of ids assigned.
export function assignIds(cards) {
  const used = new Set(cards.map((c) => c.id).filter(Boolean));
  let added = 0;
  for (const c of cards) {
    if (c.id) continue;
    const base = `${c.language}-${slug(c.translit || c.prompt || c.meaning)}`;
    let id = base, n = 1;
    while (used.has(id)) { n += 1; id = `${base}-${n}`; }
    used.add(id);
    // place `id` first for readability (drop any pre-existing empty id field)
    const { id: _empty, language, ...rest } = c;
    Object.keys(c).forEach((k) => delete c[k]);
    Object.assign(c, { id, language, ...rest });
    added += 1;
  }
  return added;
}
