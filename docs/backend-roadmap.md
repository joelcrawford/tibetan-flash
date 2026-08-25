# Backend roadmap — ingest · dictionary · corpus (then Explore)

**Status:** Planning notes — nothing here is built yet. Captured 2026-08-24 to
return to when we're ready to build the data backend. **UX is paused** until this
backend exists (especially Explore).

**Related:** [explore-phase.md](./explore-phase.md) (the Explore vision),
[spec-texts-read-explore.md](./spec-texts-read-explore.md) (reader spec),
[spec-card-id-migration.md](./spec-card-id-migration.md) (done).

---

## Where we are now (context)

The **Read** surface ships on both platforms: curated Tibetan text with folios,
verse-aware layout, romanization (Under / By-line), font-size control, a real
screen (not a modal), and a per-text **bookmark**. Multi-language architecture is
in (Tibetan + Japanese, pluggable `Language` modules). Card-ids are migrated.

**How the one ingested text got in (the throwaway path):** we hand-fed
*authoritative Unicode*, split it into tokens/folios/breaks
([scripts/ingest-text.mjs](../scripts/ingest-text.mjs)). Data model stores
`Token{script, translit}` — script = Unicode, translit = ACIP; Wylie is derived.

**✅ The standardized converter is now integrated** (2026-08-25). The Asian Legacy
Library ALL converter (`public-library-api/server/converters`) is vendored at
[shared/languages/tibetan/convert/](../shared/languages/tibetan/convert/) — a single
canonical Unicode ⇄ Wylie ⇄ ACIP path shared by web, iOS, and the ingest scripts.
This **replaced the stopgap** `romanize.mjs` (which was lossy on the achung/genitive:
it wrote `B'I`/`PO'`/`SKU'` where the standard is `BA'I`/`PO'I`/`SKU'I`, and used
`W` for wa-zur where ACIP uses `V`). Consequences already landed:
- Runtime ACIP→Wylie in the Tibetan module now calls the converter (accurate Wylie
  everywhere: reader, sidebar text names).
- The Dus-grwa text's `translit` was regenerated from its authoritative Unicode
  (174 tokens / 7.7% corrected). `romanize.mjs` now delegates to the converter and
  its `--verify` round-trips ACIP→Unicode at **99.9%** (2256/2259).
- The 3 remaining round-trip failures are the stray long-a artifact in `གྲྭཱི`/`གྲྭཱང`
  — **flagged, not auto-corrected** (a "normalize" decision for human proofing).

The roadmap below still applies for **ACIP-first ingest from source** (we currently
derive ACIP from hand-fed Unicode; the goal is ACIP source in → Unicode + Wylie out).

---

## 1. Text ingest pipeline — **ACIP is the standard**

**Decision:** our source is an **ACIP collection**, so **ACIP is the canonical
stored form** for corpus texts. We do **not** hand-feed Unicode anymore.

**Flow:** `ACIP source → [official conversion pipeline] → Unicode (script) + Wylie`
- ✅ The **official converter** is now vendored at
  [shared/languages/tibetan/convert/](../shared/languages/tibetan/convert/) (from
  `public-library-api/server/converters`). It exposes `convert(text, from, to)` over
  a `TibetanScript` enum (UNICODE/WYLIE/ACIP) and **replaced** the stopgap
  `scripts/romanize.mjs`. It gives **ACIP → Unicode** (rendering script), which the
  ACIP-first ingest below needs. Re-vendor from the source repo to update; don't
  hand-edit the rules.
- This *inverts* the current direction: today Unicode is authoritative and ACIP is
  derived (badly). New world: **ACIP authoritative**, Unicode + Wylie **derived**
  by the official pipeline. This already matches our storage decision ("store one
  canonical translit, derive the rest") — we just make ACIP the canonical input.

**Reconciliation with the data model** (no schema change needed, just how it's filled):
- `Token.translit` = ACIP (canonical, from source).
- `Token.script` = Unicode (converted, for rendering).
- Wylie = derived from ACIP at read time (already done via `Language.toScheme`).

**"Format text for reading" — a standardized formatting + validation stage.**
Part of the ingest pipeline: every text is run through the *same* battery of
formatting, checks, and validation before it becomes a reading artifact. Goals:
consistency (all texts look/behave alike), catch errors early, and produce a
report. Roughly three passes:

- **Normalize / format** — canonical tsek/shad spacing; strip or record folio
  ornaments (༄༅), running headers (verso/recto), section marks (༈); handle stray
  OCR fragments (e.g. a leading `ཉིན།`); normalize page markers to folio-side labels
  (`001a/001b`); mark verse vs prose (hard breaks); flag/normalize source artifacts
  (e.g. the stray long-a `ཱ` seen in `གྲྭཱི`).
- **Convert** — ACIP → Unicode + Wylie via the official pipeline (§ above).
- **Validate / check** — a standardized checklist, e.g.: well-formed Tibetan stacks
  (no invalid syllables); **ACIP↔Unicode round-trips** (convert back, compare);
  no ornaments/headers leaked into the reading flow; folio labels present, valid
  (`\d{3}[ab]`) and sequential (verso/recto matches the header alternation); page
  breaks reference valid positions; hard breaks land on real boundaries; every token
  has `script` + `translit`; unknown/unmapped glyphs surfaced for review. Output a
  per-text **report** (pass/fail + warnings) so a human proofs the flagged items.

The current `scripts/reader.test.mjs` is the seed of this battery — generalize it
from "test the one text" into a reusable per-text validator run at ingest time.

**Open decisions — "how we hold our texts":**
- **Storage format & location** — per-text JSON under `shared/languages/<code>/texts/`
  today (bundled at build time). Do we keep bundling, or move to a fetched/remote
  store (ties into "no API yet" — see [there's currently no data API]).
- **Source of record** — keep the raw ACIP source committed (like
  `texts/sources/*.acip.txt`) as the input the pipeline runs on; the JSON is a build
  artifact. Decide whether the JSON is committed or generated in CI.
- **Pagination & structure** — folio-side labels (`001a/001b`), verso/recto from
  running headers, clause splitting (shad), verse vs prose (hard breaks), stripping
  running headers/ornaments. The current ingest does all this for Tibetan pecha —
  generalize it (Sanskrit daṇḍa, Chinese, etc.) per the `Language` module.
- **Provenance / metadata** — title, author, edition, source collection id, folio
  numbering scheme, per-text `language`, translation credits.
- **Versioning** — texts will be re-ingested as the converter/source improves; need
  stable text ids and a way to re-run without breaking bookmarks (bookmarks key on
  a display-line index — reconsider keying on something more stable, e.g. a folio +
  clause offset, if line indices shift on re-ingest).
- **Convention** — ACIP TZ/TS vs standard; the official converter settles this.

---

## 2. Dictionary — word breakdown (feeds Explore)

**Purpose:** break a text into **words** and define them — the "tap a word → what
is it" layer of Explore (segmentation + gloss + part of speech + lemma).

**Open decisions:**
- **Source & licence** — which Tibetan dictionary/dataset (headwords, senses, POS,
  Sanskrit equivalents). Pull from the same backend repos?
- **Format & schema** — headword (ACIP + Unicode), senses, POS, lemma, cross-refs.
  Maps onto the reader's `DictEntry` (already in `types.ts`: meaning/pos/notes/
  particle/stems/glossaryId).
- **Segmentation** — how we get word spans over a text (the `words`/`phrases`
  arrays). Hand-authored for the first passages; automatic segmentation is the hard,
  scale problem (Tibetan has no spaces). Is there a segmenter in the backend, or do
  we author per curated text?
- **Linking** — text span → dictionary entry (`DictEntry.glossaryId` or a dict id);
  and dictionary entry ↔ Learn cards (capture into deck).

---

## 3. Translated corpus — context for a term (feeds Explore)

**Purpose:** for any term, show **previously-translated context** — real
occurrences of that term in already-translated texts, with their English (or other)
translation. A concordance / parallel corpus, so a learner sees "here's how this
word was rendered in context before."

**Open decisions:**
- **Storage & alignment** — parallel corpus of source (ACIP/Unicode) ↔ translation,
  aligned at some granularity (segment / sentence / clause). Where does it live?
- **Lookup** — index term (lemma/headword) → occurrences → aligned translations.
  Needs the dictionary's lemmatization to match inflected forms to a headword.
- **Scale** — potentially large; likely wants a real backend/API rather than bundling
  (again ties into the "no data API yet" gap).

---

## 4. Explore UX — **deferred until 1–3 exist**

Explore = **dictionary** (break the word down: anatomy, POS, senses, particle
families, verb stems) **+ corpus** (show prior translated context for the term).
The interaction (Peek → Explore → Anatomy, the blue nested word-washes, capture into
Learn) is fully specced in [explore-phase.md](./explore-phase.md). **Do not build
the UX until the dictionary + corpus data are in place** — otherwise we're
hand-authoring throwaway span/definition data again.

---

## Suggested sequencing when we return

1. **Ingest pipeline v1** — pull the official ACIP→Unicode/Wylie converter from the
   other repo; wire it into `scripts/ingest-text.mjs` (ACIP in → JSON out); build the
   **"format text for reading" stage** (standardized normalize → convert → validate,
   with a per-text report); decide text storage/provenance/versioning; re-ingest the
   Dus-grwa text properly (and finish folio 007a, which was cut off).
2. **Decide the storage/serving model** — bundled vs a real data API (currently the
   app has only a TTS microservice; no content/progress API). Corpus + dictionary
   scale may force an API + DB.
3. **Dictionary** — ingest, schema, segmentation, span→entry linking.
4. **Translated corpus** — ingest, alignment, term lookup.
5. **Explore UX** — build per explore-phase.md, now backed by real data. Revisit the
   card-id-namespaced links and the status overlay.

## Open questions to settle first

- Bundle texts/dictionary/corpus in the app, or serve from an API? (Corpus size
  likely decides this.)
- Are the ingest source files (ACIP) committed, with JSON generated in CI — or JSON
  committed directly?
- Bookmark stability across re-ingest (key on folio+offset, not raw line index?).
- One canonical romanization (ACIP) confirmed for all Tibetan storage; Wylie always
  derived.
