# Editor automatic synchronization

Current editors submit the fields or stable-ID changes the author made against
their observed baseline. Collection writes without a baseline are rejected;
they never become whole-value replacements. Different fields merge, and the
last server-accepted change wins when both editors change the same scalar.
Canonical acknowledgments update connected editors automatically.

Post, Page, Work, MapTheme and other document editors keep pending writes
through canonical reloads. Body recovery replays semantic changes into a fresh
authorized document; it does not hydrate a stale raw Yjs document. Deleted peer
nodes remain deleted. An explicit parent deletion also removes its current
descendants. Room, locale and source-locale authority must match before replay.

Body durability is separate from version checkpoints. A Block-room body intent
is cleared only when the server's persisted state vector and deletion ranges
cover it. Checkpointing an already accepted version cannot acknowledge dirty
body changes. Navigation barriers drain registered body and metadata writes.

The navigation and unload barrier uses the same persisted acknowledgment as the
body recovery journal. It retains one cumulative state vector and pending
deletion ranges, captured from local transactions without serializing the full
document again. A covering acknowledgment clears the barrier after autosave.
An older acknowledgment cannot clear newer input or a deletion it does not
cover. A persist-now response alone cannot acknowledge Block-room changes; a
bounded wait for the persisted acknowledgment keeps failed saves pending.

The entity editor owns the runtime and its body save tracker. Nested rich-text
surfaces consume that same provider, entity identity and persistence contract;
they do not register another runtime. Post, Work and ProgramEvent previously
mounted a second runtime without the Block-room protocol. Its persist-now-only
tracker stayed pending after the authoritative tracker had accepted an autosave
ACK. Production Chrome debugging identified both trackers on the same Post
document: the Block-room tracker was clear while the nested tracker reported
33 local revisions and zero explicit flush revisions. Page's outer context
already owns its body tracker and shares the same surface contract.

Old metadata negotiation, baseline-free replacements, manual recovery/download
dialogs and unused fragment-backed editor APIs are removed. Form schemas use
the server-serialized patch protocol; direct whole-schema Yjs updates are
rejected. Current canonical renderer adapters remain part of the application.

## Recovery journal measurement

The regression fixture in `lib/collab/block-room-intent-journal.test.ts` records
the same 200 consecutive Page leaf edits with identical canonical snapshots.
It compares an uncoalesced journal with the current coalesced journal using the
same canonical protobuf serialization for retained snapshot byte counts.

| Retained data            | Uncoalesced | Coalesced |
| ------------------------ | ----------: | --------: |
| Journal entries          |         200 |         1 |
| Canonical snapshot bytes |      77,782 |       388 |

Retained snapshot bytes decrease by 99.5%. This measures snapshot retention,
not total JavaScript heap, renderer latency or page loading time. Coalescing
requires the preceding after-snapshot to equal the next before-snapshot;
intervening peer changes remain separate. Partial durable acknowledgments keep
the combined intent, including every deletion range.

## Current table data check

On 2026-10-01, read-only production queries found three current table blocks:
23 base rows and 49 base cells, plus 276 localized rows and 588 localized cells.
Every row/cell had an ID. Base IDs were valid UUIDs; localized row/cell IDs and
cell counts matched the corresponding base positions. No content was changed.
This check covers current canonical records, not historical version snapshots.

## Connected browser check

On 2026-10-02 (Asia/Seoul), Google Chrome checked the production Page and Post
regression documents with two connected tabs each, after API v1.0.0 and
Web/Collab v0.3.0 rolled out. Summary and option changes reached the other tab
automatically. Temporary body sections and paragraphs appeared in the peer tab,
then disappeared after deletion and remained deleted after a server reload.
The original body content survived. Summary edits made immediately before
navigation were present after returning and receiving canonical state.

Those checks also exposed a stale unload guard: a local body edit remained
marked pending even after autosave and a peer deletion had completed. The
shared persisted-acknowledgment tracker addresses that bookkeeping error for
both Page and Post. Focused regressions distinguish transport synchronization,
request acknowledgment and actual body durability, including delete-only
changes and input arriving while a save is in flight.

## Validation boundary

Validate shared contracts and Common helpers first, then API, collaboration and
Web against the same released dependencies. Local-contract test configurations
resolve sibling sources; default test configurations resolve published packages.
Passing only one boundary does not validate the other.

The local Docker engine became unresponsive during this work and was recovered
on 2026-10-01 without deleting container or VM data. PostgreSQL integration
suites run through the repository's protected lease runner on an isolated test
host. Unit tests and integration compilation do not establish database
concurrency behavior. Deployment verification must include connected browser
editors and production logs after the complete service rollout.
