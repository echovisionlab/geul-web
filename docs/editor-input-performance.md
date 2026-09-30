# Post and Page editor input performance

Post, Work, Program Event, and Page rich-text editors use the same Tiptap to
canonical Block-room controller. Payload edits and structural edits have separate
paths:

- When block identities and nesting stay unchanged, compare persistent ProseMirror
  node references and serialize only changed block payloads. Unchanged nested
  subtrees are skipped.
- Insertions, deletions, reorders, nesting changes, and block kind replacements
  use the complete structural diff. The working sibling order has an ID-to-position
  index, updated when a sibling list changes.
- Persist the final editor state, including transactions appended by plugins.
  A selection-only root transaction can still contain an appended document change.
- Connected controllers receive refreshed descriptors synchronously from the room
  observer; they do not decode the room a second time after their own write.

One shared change observer is registered per resident Y.Doc. Canonical snapshots
and section-routing indexes are computed at most once per observed change and
shared among subscribers. A Page rich-text bridge publishes only changes to its
section, retaining a separate set of previously visible IDs for each subscription
so every subscriber receives deletions. New subscriptions capture current IDs.

The Page sections controller publishes section properties, locale values, settings,
and topology changes. Rich-text block body edits do not rebuild the sections
projection or replace the Page context's sections array. Unknown root changes,
document metadata, and layout changes retain the full validated projection path.

Public reads always decode current resident state. Narrow mutation authority,
source/target locale rules, persistence acknowledgements, and collaboration undo
remain unchanged. The observer dispatcher delivers synchronous notifications,
handles unsubscribe/re-subscribe and reentrant changes, and continues notifying
other subscribers if one listener throws before propagating the first error.

## Reproducible local measurement

Run the fixed fixtures with the project Node version:

```sh
EDITOR_PERFORMANCE_REPORT=/tmp/editor-input-results.json pnpm exec vitest run features/editor/tiptap/block-room-input-performance.test.ts
```

Without the report environment variable, these tests only verify fixture correctness
and observer routing. CI does not enforce wall-clock timing thresholds.

The 2026-09-30 comparison uses Node 24.19.0, Vitest 4.1.10, jsdom, and the published
Common dependency. Every paragraph initially has 80 characters; one character is
inserted into the first paragraph repeatedly. Initialization is outside timing,
and the first five edits are warm-up. Post samples 20 edits per size. Page samples
15 edits with a fixed total of 500 paragraphs divided among 1, 5, or 20 rich-text
sections, with one sections-controller subscriber and one bridge per section.

The Page measurement includes Yjs mutation and synchronous observers. Post also
includes actual Tiptap transaction dispatch. Neither measures production browser
INP, React NodeView rendering, browser paint, network, API, or database latency.
The jsdom Canvas warning concerns an imported runtime; these paragraph-only
fixtures do not render Canvas content.

Canonical projection and Common's change-index collection still traverse the room
once per update. This change removes repeated observer work and whole-document
input serialization; it does not make all processing independent of document size.
Server sync authorization still copies and validates resident documents and needs
separate profiling before any change to that security boundary.

## 2026-09-30 before/after results

The baseline input source is commit `fddc328`, identical in the measured controller,
bridge, and Page sections paths to main release `f11d214` (v0.2.1). The optimized run
uses the same fixtures, Node, dependencies, sample counts, insertion position, and
warm-up. The routing assertion changes from one callback per subscriber to exactly
one callback per edit; it is outside the timed region. No other test/build workload
was running during the final measurement.

| Fixture                           | Before median (ms) | After median (ms) | Reduction | Before / after p95 (ms) |
| --------------------------------- | -----------------: | ----------------: | --------: | ----------------------: |
| Post 100 paragraphs               |               5.95 |              3.70 |     37.8% |             6.81 / 4.35 |
| Post 500 paragraphs               |              26.87 |             15.20 |     43.4% |           28.59 / 16.86 |
| Post 1000 paragraphs              |              55.01 |             30.35 |     44.8% |           56.50 / 31.67 |
| Page 500 paragraphs / 1 sections  |              35.11 |             15.42 |     56.1% |           37.55 / 25.46 |
| Page 500 paragraphs / 5 sections  |              84.47 |             15.33 |     81.9% |           87.60 / 16.90 |
| Page 500 paragraphs / 20 sections |             277.21 |             15.68 |     94.3% |          313.38 / 17.65 |

Page observer callbacks per edit change from 2 / 6 / 21 for 1 / 5 / 20 sections to
1 / 1 / 1. Only the affected rich-text bridge is notified, and the Page sections
projection is not rebuilt for body typing. Each case verifies successful edits and
subscriber delivery; absolute timing is recorded, not asserted.

Root validation: 14 focused integration files / 172 tests, plus the performance
fixtures (2 tests), cover typed payload mutation, nested input, empty blocks,
reorder/deletion, heading conversion, tables, executable source, source/target
locale authority, collaboration projection, pending remote edits, plugin-appended
transactions, undo/redo, Page context/body integration, observer fanout, and
unsubscribe/reconnect. TypeScript, changed-path ESLint, Prettier, and diff whitespace checks passed
before commit. Full build and suite execution remain CI release gates.

## Concurrent inline edit integrity (2026-10-01)

Inline text and marks reconcile on existing Y.Text handles. Whole and partial
format changes no longer delete and recreate the concurrently edited text.
Physical payload indexes remain raw indexes; materialization projects formatted
runs into the existing protobuf JSON shape. Table cell text and existing link
children use this same rule. A true text/link structural conversion still replaces
a minimal structural window.

Link addresses are written only when they change, so typing cannot overwrite a
concurrent address edit. Both inline and source-text edit boundaries preserve
complete Unicode surrogate pairs.

Remote updates are projected synchronously before another local editor transaction.
For structural deletion, ancestors of surviving children stay resident until those
children move out; complete discarded subtrees are removed first, avoiding extra
reorder mutations after Backspace. Undo continues to use the existing room origin.

Web and Collab use Block-room protocol version 2. A version mismatch requests
reload before bootstrap application or write admission. Deploy the Collab reader
before the Web writer; the canonical protobuf and storage schema stay unchanged.

The first inline integrity implementation added projection overhead. The final
projection decodes inline content, table rows, and cell content once, preserving
all existing malformed-payload validation. Preliminary local measurements are
kept as diagnostics; the final published-dependency comparison follows below.

### Final published-package comparison

Three alternating before/after runs use the identical fixture, dependencies,
sample counts, and warm-up above. Baseline is Web v0.2.2's controller/bridge/diff
with published Common v0.2.1; after uses this change with published Common v0.2.3.
Proto/event v0.2.1, Node, and Yjs remain fixed. No other local tests or builds ran.
The table reports the median of each run's median and p95, not a pooled percentile.
Raw audit artifacts are `editor-integrity-final-{before,after}-{1,2,3}-20261001.json`.

| Fixture                           | Before median (ms) | After median (ms) | Median change | Before / after p95 (ms) |
| --------------------------------- | -----------------: | ----------------: | ------------: | ----------------------: |
| Post 100 paragraphs               |               3.73 |              3.59 |         -3.8% |             4.36 / 4.75 |
| Post 500 paragraphs               |              14.68 |             14.69 |         +0.1% |           16.47 / 16.50 |
| Post 1000 paragraphs              |              30.61 |             29.38 |         -4.0% |           35.45 / 30.15 |
| Page 500 paragraphs / 1 section   |              16.75 |             14.93 |        -10.9% |           17.92 / 26.49 |
| Page 500 paragraphs / 5 sections  |              15.72 |             15.13 |         -3.8% |           17.41 / 16.68 |
| Page 500 paragraphs / 20 sections |              15.48 |             15.35 |         -0.8% |           16.71 / 17.38 |

Notifications remain exactly one per edit in all Page fixtures. This establishes
that the integrity fixes and projection fast path retain the previous performance
work; the small differences and noisy tails do not establish a production browser
latency improvement. Post 500 is effectively unchanged, and Page one-section p95
is higher. There are no browser INP, paint, network, or persistence measurements.
The first Common v0.2.2 projection cost is retained in separate diagnostic runs;
removing duplicate decoding, unchanged-style normalization, and unused payload
allocation removes that extra work in v0.2.3.
