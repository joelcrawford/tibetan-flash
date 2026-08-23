# UX Direction — Texts (Read + Explore)

**Status:** In progress — spine settled, details open
**Date:** 2026-08-22
**Related:** [spec-card-id-migration.md](./spec-card-id-migration.md) (hard dependency),
prototypes [tibetan-flash-reader.jsx](./tibetan-flash-reader.jsx),
[tibetan-reader.jsx](./tibetan-reader.jsx)

---

## 1. The idea in one line

Turn the flashcard app into a loop: **read real texts → capture words from them →
drill them → see them light up next time you read.**

## 2. Three verbs, two destinations

The app has three verbs but does not pay for three top-level places.

| Verb | What it is | Where it lives |
|---|---|---|
| **Learn** | recall & retain — the existing flip-card deck | its own destination (today's app) |
| **Read** | fluency & flow — read a whole text top-to-bottom | the **Texts** destination (resting state) |
| **Explore** | understand how it works — dissect a word/syllable/grammar | a **depth inside Texts**, summoned per-word |

- **Learn** is a place. **Read** and **Explore** are two *intents* that share the
  **Texts** place.
- **Nav:** two destinations ⇒ a lightweight header toggle (relabel of the
  prototype's `Read ⇄ Cards`). No bottom tab bar yet.
- **Explore links into existing Learn sessions** — tapping a letter-slot opens the
  real `00 Alphabet` card. "Systems" (alphabet, case particles) stay as drillable
  sessions rather than a separate browser.
- **Standalone "language lab"** (Explore reachable with no text — case tables,
  grammar maps, the alphabet grid) is **parked, not designed out.** The Explore
  sheet should be built so it *can* later grow standalone entry points without
  rework. Revisit only if it earns its place.

## 3. Texts surface — the interaction ladder

Reading is the calm default; Explore is a deliberate climb. Each rung is opt-in,
so a fluency session and a study session use the same screen at different heights.

```
L0 · READ      clean flowing text; known words underline quietly (Learn overlay)
                 │  tap a word
L1 · PEEK      glanceable inline reveal — romanization + one-line gloss
                 │  "dissect ›"  (or long-press)
L2 · EXPLORE   bottom sheet: meaning · part of speech · particle family ·
               verb stems · "make a card" · door to anatomy
                 │  "break apart"
L3 · ANATOMY   7 orthographic slots; tap a slot → the real 00 Alphabet card
```

- **L0 Read** — the resting state. No pops. Known-word underlines come from the
  Learn status map (the whole reason the [id migration](./spec-card-id-migration.md)
  must land first — otherwise `MA`/`LA`/empty-acip collisions mis-color the text).
- **L1 Peek — INCLUDED.** A tap is a *reading aid*, not a dissection: you blanked
  on one word, glance at sound + gloss, keep reading. Dismiss by tapping away. No
  sheet, no commitment. This is what lets "just reading" stay in flow.
- **L2 Explore** — summoned intentionally. The rich prototype sheet.
- **L3 Anatomy** — the syllable's seven slots, each linking to its alphabet card.

## 4. How it plugs into the existing app

- **Texts are sessions.** A text becomes a synthetic session (e.g.
  `Text — Refuge Verse`) so it reuses all existing session filtering/grouping in
  Learn. One corpus, three lenses: a *session* to drill (Learn), a *thing to read*
  (Read), a *thing to take apart* (Explore).
- **Capture → Learn.** "Make a card" in Explore creates a card that stores the
  source line as `context_tibetan`, filed under the text's session. It enters the
  normal deck at `review`.
- **Status overlay ← Learn.** Read/Explore render each word's deck status
  (review/familiar/known) as the underline. Requires stable card `id`s.

## 5. Decisions log

| # | Decision | Rationale |
|---|---|---|
| D1 | Three verbs: Learn / Read / Explore | Reading fluency and language-dissection are distinct acts, not one "Read." |
| D2 | Two destinations: Learn · Texts | Read + Explore share the Texts place; avoids 3-way nav weight. |
| D3 | Texts are sessions | Reuses existing filtering/grouping; one corpus, three lenses. |
| D4 | Explore is a depth, not a destination | Summoned inside a text; links into existing sessions. |
| D5 | Standalone lab parked (not killed) | Big new surface; defer, but keep the sheet extensible. |
| D6 | Read default, Explore summoned | Reading is the calm resting state; dissection is opt-in. |
| D7 | Include L1 Peek | Lets fluency practice get a quick nudge without leaving flow. |
| D8 | Header toggle nav (for now) | Only two destinations; lightest change to current chrome. |

## 6. Open questions (not yet decided)

- **Summon gesture.** Is L1→L2 a "dissect ›" affordance on the peek, a long-press,
  or both? (Prototype currently: tap=word, long-press=anatomy — needs rework for
  the read-default ladder.)
- **Peek contents & dismissal.** Inline under the word vs a small popover; how it
  coexists with the known-word underline.
- **Reading defaults.** Romanization on or off by default in L0? Per-line audio /
  chant affordance? Translation visibility?
- **Corpus & Library.** Where texts come from, how one is chosen, how the first N
  class texts get their span/dictionary/anatomy data (hand-authored to start).
- **Vocabulary.** Do we rename `Cards` → `Learn` in the UI, and call the surface
  `Texts` or `Read`?
- **RN port.** Gestures/bottom-sheet/long-press are DOM in the prototype; iOS is
  React Native. Plan the port.
- **Scale of dictionary data.** The tap→word→narrow magic needs pre-segmented
  spans; fine for a curated curriculum, an open problem for arbitrary texts.

## 7. Dependencies / sequencing

1. **Land the [id migration](./spec-card-id-migration.md) first** — the status
   overlay and capture-into-deck both require unique card ids.
2. Then build the Texts surface at L0–L1 (Read + Peek) over one hand-authored
   text; add L2–L3 (Explore + Anatomy) on top.
