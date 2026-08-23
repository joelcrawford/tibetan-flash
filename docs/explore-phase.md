# Explore — Phase 2 kickoff

**Status:** Planned (not started). Reading (Phase 1) is built; Explore is next.
**Full technical detail:** [spec-texts-read-explore.md](./spec-texts-read-explore.md) §5–8.
**Feel:** the approved mockup [mockup-texts-read-explore.html](./mockup-texts-read-explore.html).
**Why/decisions:** [ux-texts-read-explore.md](./ux-texts-read-explore.md).

This doc captures the **Explore ideas** so nothing from the design conversation is
lost while we defer the build.

---

## 1. The idea

Reading (Phase 1, shipped on this branch) is *decode the script and sound it out*.
**Explore** is the next rung: *understand how a word is built and how the sentence
works* — summoned on demand from inside a text, never forced on the reader.

> Read to encounter → **Explore to understand** → capture to Learn → drill → meet
> it again while reading.

Explore is a **depth inside the Texts surface**, not a separate destination. The
standalone "language lab" (Explore with no text) stays parked (§6).

## 2. The interaction ladder (Explore = L1→L3)

Reading is the calm default (L0). Explore is the deliberate climb:

- **L1 · Peek** — tap a word → a slim inline reveal: romanization + one-line gloss +
  deck-status dot. A reading aid, dismissible, no sheet. *(Long-press jumps
  straight to L2.)*
- **L2 · Explore** — "Dissect ›" → bottom sheet: meaning · part of speech ·
  glossary context · **particle family** · **verb stems** · **Make a card** ·
  **Break apart**. A stepper widens/narrows the selection (phrase ↔ word ↔ syllable).
- **L3 · Anatomy** — "Break apart" → the seven orthographic slots; tap a slot →
  the real **00 Alphabet** card for that letter.

## 3. Word boundaries — the blue nested washes

To make words tappable, the reader shows dictionary word-boundaries as **translucent
blue washes**, toggled on from the reading bar (a `Words` control alongside
`Romanization`). The key idea we landed on:

- One neutral **blue** (`#2f5e96` light / `#7aa8e0` dark) — *not* colour-coded by
  grammar or status (that's deferred, §6).
- **Nesting via transparency**: a phrase's lighter wash sits *under* the darker word
  washes inside it, so a long compound visibly decomposes into its words (e.g.
  ཚོགས་ཀྱི་མཆོག = "the supreme assembly" over ཚོགས · ཀྱི · མཆོག). Tap a word → the
  word; tap the surrounding wash → the phrase.
- **Tapability is gated on `Words`** — with it off, the text is clean, untappable
  script (pure reading). Explore only exists once you ask for boundaries.

## 4. What Explore surfaces

- **Meaning + POS + notes**, and glossary **context** when the word links to a
  glossary card (`glossaryId`).
- **Particle families** — "one particle, N shapes" (e.g. the genitive གི/གྱི/ཀྱི/ཡི/འི),
  highlighting the active form and *why* the suffix selects it (ཚོགས་ ends in ས་ → ཀྱི་).
- **Verb stems** — present/past/future/imperative, highlighting the one in the text.
- **Anatomy → alphabet** — the seven slots (prefix/superscript/root/subscript/
  vowel/suffix/post-suffix), root outlined, silent letters dimmed, linked slots
  opening the exact `00 Alphabet` card the student already studied.

## 5. Capture into Learn

"Make a card" turns a tapped word/phrase into a deck card that **remembers the line
it came from** (`context_tibetan` = the source clause), filed under the text's
session. It enters the deck at `review`; re-capture is a no-op. This closes the
loop: words found while reading become drillable, and then light up (status
overlay) next time you read.

## 6. Deferred / open (carried forward)

- **Standalone language lab** — Explore reachable with no text: an interactive case-
  particle table, agentive-marker map, sentence-shape diagrams, the alphabet grid.
  Parked, but the Explore sheet should be built so it *can* sprout these doors.
- **Word colour-coding meaning** — grammar (particle vs content) vs deck status vs
  none. Currently **none** in the running text; revisit with real use.
- **Reveal ergonomics** — whether `Romanization: under` should be the always-on aid
  and `by-line` a distinct self-test mode.

## 7. Hard dependencies before building

1. **Card-id migration** ([spec-card-id-migration.md](./spec-card-id-migration.md)) —
   the status overlay (known/familiar/review under words) and capture-into-deck both
   require unique card ids; today status is keyed on the colliding `acip`.
2. **Per-text annotation data** — `words` (segmentation), `phrases` (nesting),
   `dict` (lookup spans + particle/stems/glossary links), and `anatomy` (per
   syllable). Hand-authored per text for the curated corpus (auto-segmentation of
   arbitrary text is a separate, later problem). The reader model already carries
   optional `words`/`phrases`/`dict`; they are simply empty today.

## 8. Suggested Phase-2 order

1. Land the **card-id migration** (also fixes a live bug in the deck).
2. Author `words`/`phrases`/`dict`/`anatomy` for **one short passage** (e.g. the
   homage verse) — enough to build against.
3. Build **L1 Peek** + `Words` washes over that passage.
4. Add **L2 Explore** sheet + **L3 Anatomy** + alphabet linking.
5. Add **capture into Learn** + the status overlay.
6. Widen the annotated corpus; revisit colour-coding and the standalone lab.
