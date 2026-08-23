# Spec — Stable Card IDs (retire `acip` as the status key)

**Status:** Proposed
**Author:** (drafted with Claude)
**Date:** 2026-08-21
**Scope:** `shared/types/types.ts`, `shared/glossary/glossary.json`, `shared/hooks/useDeck.ts`, web + iOS storage adapters, one-time data migration.

---

## 1. Problem

Card progress (`review` / `familiar` / `known`) is keyed on the card's `acip`
string. In [useDeck.ts](../shared/hooks/useDeck.ts) every lookup is
`statusMap[c.acip]`, and the persisted map (`tibetan-flash-status`) is
`{ [acip]: status }`.

That key is **not unique**. As of this writing (213 cards):

| Collision | Count | Example cards |
|---|---|---|
| Empty `acip` `""` | 15 | all prompt/rule cards (head-letter, subjoined, prefix rules) |
| `MA` | 3 | Alphabet letter · Suffix · Prefix |
| `'A` | 3 | Alphabet letter · Suffix · Prefix |
| `SA` | 3 | Alphabet · Suffix · (others) |
| `GA NGA DA NA BA RA LA` | 2 each | Alphabet vs Suffix, etc. |
| `SHES BYA` | 2 | duplicated across Ben's Text sessions |

**Consequences today:**

- Marking the `MA` **alphabet** card "known" also marks the `MA` **suffix**
  and `MA` **prefix** cards known — they share one status entry.
- All 15 empty-`acip` cards read and write a **single** status under key `""`.
- `resetSession()` deletes by `acip`, so resetting one session can wipe the
  status of an identically-keyed card in another session.
- Any future **Read mode** (text-derived cards) makes this worse: a word tapped
  in a text and a session card with the same `acip` would silently share status.

The fix is a stable, unique `id` per card, used as the status key everywhere.

---

## 2. Goals / Non-goals

**Goals**
- Every card has a unique, stable `id`.
- Status, dedup, pinning, and reset all key on `id`.
- Existing users keep their progress (best-effort migration, no silent loss for
  the common non-colliding case).
- No visible behavior change for the deck algorithm.

**Non-goals**
- Changing the spaced-repetition ratios or deck-building logic.
- Read mode itself (separate spec) — this only unblocks it.
- Server-side storage (progress remains local per device).

---

## 3. Data model

Add a required `id` to `Card`:

```ts
export interface Card {
  id: string;            // NEW — stable unique key
  tibetan: string;
  acip: string;
  meaning: string;
  notes: string;
  context: string;
  context_tibetan: string;
  session: string;
  prompt?: string;
  subcategory?: string;
}
```

### 3.1 ID scheme

IDs are **generated once by a script, then committed to `glossary.json` and
never regenerated.** Stability comes from persistence, not from the algorithm —
so the algorithm only has to guarantee uniqueness at generation time.

Format: `s{NN}-{slug}[-{n}]`

- `s{NN}` — session number prefix when the session name starts with digits
  (`00 Alphabet` → `s00`); otherwise a slug of the session
  (`Compound Words & Phrases` → `compound-words-phrases`).
- `{slug}` — from `acip` lowercased and kebab-cased; if `acip` is empty, fall
  back to a translit of `prompt`, else of `tibetan`.
- `-{n}` — numeric disambiguator appended only when the base collides, assigned
  in current array order (stable as long as the JSON isn't reordered before
  first generation).

Examples:

| session | acip | subcategory | id |
|---|---|---|---|
| 00 Alphabet | `MA` | Alphabet | `s00-ma` |
| 00 Alphabet | `MA` | Suffix | `s00-ma-2` |
| 00 Alphabet | `MA` | Prefix | `s00-ma-3` |
| 00 Alphabet | `` (prompt) | Head Letter | `s00-head-letter-first-column-…` |
| 05 Ben's Text | `SANGS RGYAS` | — | `s05-sangs-rgyas` |

> Once merged, IDs are **immutable data**. Editing a card's `acip` later does
> **not** change its `id`. New cards get new ids from the same generator, which
> reads existing ids and only fills gaps.

### 3.2 Generator script

`scripts/assign-ids.mjs` (Node, run manually):

1. Read `glossary.json`.
2. For each card **without** an `id`, compute the base slug; append `-{n}` if the
   base (or a lower `-{n}`) is already taken by an existing or just-assigned id.
3. Write back with 2-space indent + trailing newline (match current format).
4. Print a summary (N ids added, 0 changed).

Idempotent: re-running never rewrites an existing id.

---

## 4. Code changes — `useDeck.ts`

Replace every `c.acip` **status key** with `c.id`. Mechanical, one file:

| Line (approx) | Now | After |
|---|---|---|
| 98–100 | `statusMap[c.acip]` filters | `statusMap[c.id]` |
| 108–116 | `pinnedAcipRef` / `c.acip === …` | `pinnedIdRef` / `c.id === …` |
| 131–132 | `statusMap[c.acip]` counts | `statusMap[c.id]` |
| 155–167 | `markStatus`/`rateCard` write `[card.acip]` | `[card.id]` |
| 173–175 | `getCardStatus(acip)` | `getCardStatus(id)` (rename param) |
| 189–198 | `resetSession` deletes by `acip` set | delete by `id` set |

`StatusMap` type is unchanged (`Record<string, CardStatus>`) — only the meaning
of the key changes.

**Call sites to update** (they pass `acip` into `getCardStatus` / keyExtractor):

- `apps/ios/App.tsx` — `getCardStatus(item.acip)` → `getCardStatus(item.id)`;
  `keyExtractor={(item, i) => \`${i}-${item.id}\`}`.
- `apps/web/src/App.tsx` — same `getCardStatus`/status call sites.

---

## 5. Storage migration (existing users)

Existing maps are keyed by `acip`. Migrate once, in the storage-load path,
gated by a schema-version marker so it runs exactly once per device.

### 5.1 Versioning

Store a sibling key `tibetan-flash-schema` (web: localStorage, iOS:
AsyncStorage). Absent/`< 2` ⇒ run migration, then set to `2`.

### 5.2 Transform `{[acip]: status}` → `{[id]: status}`

Build `acip → [id...]` from the current glossary, then:

- **Non-colliding acip (1 card):** copy status to that `id`. Lossless.
- **Colliding acip (>1 card):** **fan out** — apply the old status to *every*
  card sharing that acip. This exactly reproduces today's behavior (they were
  already one status), so it is a no-regression default; users then
  differentiate naturally as they study.
- **Empty acip `""`:** **drop.** The shared `""` status was meaningless
  (15 unrelated cards). Do not fan a single value out to all of them.

```ts
function migrateStatusMap(old: Record<string, CardStatus>, cards: Card[]): StatusMap {
  const byAcip = new Map<string, string[]>();
  for (const c of cards) {
    if (!c.acip) continue;                      // skip empty — dropped
    (byAcip.get(c.acip) ?? byAcip.set(c.acip, []).get(c.acip)!).push(c.id);
  }
  const next: StatusMap = {};
  for (const [acip, status] of Object.entries(old)) {
    for (const id of byAcip.get(acip) ?? []) next[id] = status;
  }
  return next;
}
```

Runs in the adapter `load()` (or a thin wrapper) before `setStatusMap`. Filters
key (`tibetan-flash-filters`) is unaffected — it stores session names.

### 5.3 Rollback

If reverted, old builds read `tibetan-flash-status` as acip-keyed. Migrated
(id-keyed) data won't match acip lookups → those users see progress reset to
`review` on the old build, but **the data is not destroyed** (keys just don't
resolve). Acceptable for a local-only, low-stakes progress map. If we want a
clean rollback, write the migrated map under a **new** key
(`tibetan-flash-status-v2`) and leave v1 untouched.
**Recommendation: use a new key `-v2`** so rollback is truly lossless.

---

## 6. Testing / acceptance

1. **Generator:** run twice → second run reports "0 added, 0 changed"; all ids
   unique; `npm run typecheck` passes with `id` required.
2. **Collision fixed:** mark `MA` (Alphabet) known → `MA` (Suffix) and
   `MA` (Prefix) stay `review`.
3. **Empty-acip fixed:** mark one head-letter rule card known → the other 14
   stay `review`.
4. **Reset scoped:** `resetSession("00 Alphabet")` leaves same-acip cards in
   other sessions untouched.
5. **Migration, non-colliding:** seed a v1 map `{ "SANGS RGYAS": "known" }` →
   after load, `s05-sangs-rgyas` is `known`.
6. **Migration, colliding:** seed `{ "MA": "familiar" }` → all three MA cards
   read `familiar` (no regression), independently changeable thereafter.
7. **Migration, empty:** seed `{ "": "known" }` → dropped; all prompt cards
   `review`.
8. **Idempotent load:** second app open does not re-migrate (schema flag set).

---

## 7. Rollout

1. Land generator + run it → `glossary.json` gains `id`s (data-only diff).
2. Land `types.ts` (`id` required) + `useDeck.ts` re-key + call-site updates +
   migration-on-load writing to `tibetan-flash-status-v2`.
3. `npm run typecheck`, manual pass of §6 on web (localStorage) and iOS
   (AsyncStorage).
4. Commit. Ship web via push; iOS via `npm run ship`.

No user-facing UI changes; this is purely a correctness/plumbing fix and a
prerequisite for Read mode.
