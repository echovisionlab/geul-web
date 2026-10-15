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

The fixed fixture uses Node 24.19.0, Vitest 4.1.10, jsdom, and the published
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

## Concurrent inline edit integrity

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

## Controller planner measurement

The structural controller now creates a pure ordered plan before its room
transaction; the controller still owns connection lifetime, synchronous remote
projection and atomic application. Common separates inline input and UTF-16-safe
text diff calculations from Yjs writes, and locale target resolution from value
projection and presence storage. These changes retain the payload typing fast path
and the existing observer routing.

Three alternating comparisons use the unchanged fixtures described above. Before
uses Web v0.2.4's controller (`bad9c7e`) and Common v0.2.3; after uses the extracted
controller planner and published Common v0.2.4. Node 24.19.0, Vitest 4.1.10, jsdom,
Proto, Yjs, other dependencies, warm-up, insertion positions and sample counts are
identical. No other local tests or builds ran during the comparisons. The table
reports the median of run medians and p95 values, not pooled percentiles.

| Fixture                           | Before median (ms) | After median (ms) | Median change | Before / after p95 (ms) |
| --------------------------------- | -----------------: | ----------------: | ------------: | ----------------------: |
| Post 100 paragraphs               |               3.20 |              3.11 |         -2.8% |             4.47 / 4.39 |
| Post 500 paragraphs               |              14.41 |             14.16 |         -1.7% |           15.29 / 14.84 |
| Post 1000 paragraphs              |              27.66 |             27.39 |         -1.0% |           28.66 / 28.41 |
| Page 500 paragraphs / 1 section   |              13.98 |             13.93 |         -0.4% |           24.87 / 21.94 |
| Page 500 paragraphs / 5 sections  |              14.43 |             14.24 |         -1.3% |           16.18 / 16.14 |
| Page 500 paragraphs / 20 sections |              14.73 |             14.87 |         +1.0% |           15.69 / 16.08 |

Page notifications remain exactly one per edit. Small median differences in both
directions do not establish a speed improvement; they provide a focused check
that the responsibility changes retain previous input performance. This fixture
does not measure structural edit latency, browser INP, paint, network, persistence,
immersive scene GPU use or production memory. Use the report environment variable above to capture comparable current runs.

## Incremental remote projection and composition (2026-10-14)

The editor bridge consumes Common's Yjs transaction change set, which indexes
`baseNodes`, `baseOrder`, `localeOverlay`, and `localePresence` event paths/keys.
Payload-only notifications decode the affected base nodes and formatted locale
Y.Text runs, retaining unchanged descriptors. The controller constructs PM nodes
only for those payloads and applies their minimal ranges in descending order in
one transaction. Unknown changes, metadata/layout, ordering, insertion/deletion,
and changed placement retain the full projection fallback. Public `readBlocks()`
still returns a fresh full snapshot. `controller.projectionStats` reports
`incremental`, `full`, `projectedBlocks`, and `buffered` notification counts.

Composition takes a temporary Y.Doc replica at `compositionstart`. Local PM edits
continue into that replica and immediately merge their Yjs updates into the live
room with the existing local undo origin. The replica deliberately does not receive
remote updates, so a composing DOM cannot overwrite unseen remote text. After the
compositionend DOM-observer microtask, the merged live state is projected once;
relative Y.Text anchors restore the caret. Undo capture is separated at composition
boundaries; remote origins remain untracked. The temporary replica is destroyed
on flush/disconnect. Starting composition copies the resident room (O(document));
this is a correctness tradeoff, not a claim of constant-time IME startup.

Presence adds optional encoded `relative` bytes to each existing `{blockId, offset}`
point. Existing peers continue reading the offset; new peers resolve Y.Text-relative
anchors. Non-text selections retain block offsets. Invalid/deleted relative anchors
are omitted rather than snapping to an unrelated text handle. Awareness updates
replace decorations only for changed clients; local transactions map existing
ones, and remote payload projections refresh clients in touched blocks.

The editor instance now survives authoring authority, translated labels and runtime
callback changes. NodeView portals receive current options through React context;
commands read live authoring refs. Room/provider/schema changes still recreate it.
Plain-text Markdown paste uses the already installed synchronous `react-markdown`
CommonMark pipeline with `remark-gfm`; no package was added. It supports schema
headings (levels 1–3), nested lists/tasks, quotes, fenced code, inline marks/links,
dividers and tables. HTML clipboard data keeps the existing paste route. Code
contexts and target-locale/structure-locked rooms do not perform Markdown conversion.

### Same-fixture measurements

Node 24.21.0, Vitest 5.0.3, jsdom, Common 0.5.0. The retained remote benchmark
applies peer Yjs updates to the middle paragraph, excludes initialization and five
warm-ups, and samples 20 updates. Baseline was captured before implementation;
after was captured with this change. The machine had concurrent work, so these
single-run timings are descriptive and do not establish production latency or
reliable tail-percentile improvements.

| Fixture                           | Before median / p95 (ms) | After median / p95 (ms) |
| --------------------------------- | -----------------------: | ----------------------: |
| Remote Post, 100 paragraphs       |              3.52 / 5.58 |             1.16 / 3.10 |
| Remote Post, 500 paragraphs       |            16.30 / 21.65 |           9.24 / 129.41 |
| Remote Post, 1000 paragraphs      |            31.87 / 32.84 |           10.66 / 16.11 |
| Local Post input, 100 paragraphs  |              3.63 / 6.49 |             1.71 / 2.94 |
| Local Post input, 500 paragraphs  |            15.21 / 17.15 |           27.49 / 68.33 |
| Local Post input, 1000 paragraphs |            30.63 / 32.22 |            9.01 / 14.53 |

All 75 remote editor updates (including warm-ups) used incremental projection:
75 payloads projected, **0 full fallbacks**. Structural parity tests separately
exercise the fallback. Page observer medians for 1/5/20 sections changed from
14.47/14.33/15.18 ms to 24.14/29.25/21.36 ms in this loaded run; notifications
remained one per edit. Shared Common indexing, order lookups and PM position scans
still depend on document size. The change avoids whole-document JSON/PM rebuilding;
it does not remove every O(document) operation.

Reproduce with the report command above. Controller tests cover same/other-block
Korean composition, undo/redo, and full-projection parity after nested text,
formatting, attributes, movement and deletion. Presence tests cover legacy peers,
relative cursor movement without an awareness resend, and malformed cursor input.
Editor-lifetime tests cover authority/label changes during active composition.

### Verification for this working-tree change

- `pnpm exec vitest run features/editor --maxWorkers 2`: 136 files, 836 tests
  passed. After the final review fixes, the focused controller, presence,
  text-position, Markdown and editor-lifetime run passed 43 tests in five files.
- ESLint passed on touched files. Prettier was limited to touched files.
- `pnpm typecheck` still reports the parallel task's locale-message type mismatch
  at `features/page/PageEditor/PageBlockSettingsSurface.test.tsx:50`; no errors
  remain in this change's files.
- Both requested Storybook commands were attempted separately:
  `pnpm exec test-storybook --index-json --url http://127.0.0.1:6010 --maxWorkers 2 -- --testPathPatterns 'feature-editor-*'`
  and the same command with `'pages-editors-*'`. Neither could reach Storybook.
  Starting Storybook failed because the sandbox disallows listening on a local
  port. No Storybook or production visual verification is claimed; Computer Use
  also denied access to Firefox.
- The mandated Astra review found cursor identity/empty-cell mapping and Markdown
  content-preservation issues. Those were fixed and regression-tested; the final
  focused review reported no additional actionable findings.

Cross-task integration: owned editor tests were updated for the parallel task's
`saved`/`saving` indicator states and provider `synced` subscription. No files owned
by that task were edited. The remaining Page test type error requires coordination
with that task before the combined tree can pass typecheck.
