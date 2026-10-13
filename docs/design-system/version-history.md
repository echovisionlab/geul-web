# Version history

Review earlier source checkpoints for a Post, Page or Work and restore one through an explicit confirmation.
The same production controller and View are used by the three editors.

## Ownership and layout

| Responsibility                                                                    | Owner                                                |
| --------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Compact width, inset, fixed header, body scrolling and focus restoration          | Core `Drawer`, `density="compact"`, `size="compact"` |
| Title and metadata hierarchy                                                      | Core Typography and Layout                           |
| Automatic continuation, keyboard fallback, pending, error, retry and end feedback | Core `NearEndLoader`                                 |
| Numeric pagination, entity identity and loaded versions                           | `useVersionHistoryQuery`                             |
| Permission, restore request and source-locale warning                             | `VersionHistoryDrawer`                               |
| Final restore confirmation                                                        | Shared `ConfirmationDialog`, intent `restore`        |

Each row puts the title first, followed by version, source locale and time. Contributors follow as secondary text.
Restore is the rightmost row action and uses Core's ordinary neutral/medium treatment.
The list uses the Drawer body as its only scroll owner; it does not add a nested ScrollArea.
The Core loader finds the closest scrolling ancestor and loads automatically near the end.

The relative timestamp is passive text inside native `time` with its ISO `datetime`.
The localized absolute timestamp is always present and connected through `aria-describedby`; native `title`
provides supplementary pointer feedback. Timestamp metadata adds no keyboard stop.
Each Restore control describes the version, title, locale and absolute time.

## Pagination and storage evidence

The production web client requests 20 versions per page. The GET route accepts `page >= 1`,
`pageSize` from 1 through 100, and an offset no greater than 2,147,483,647.
The web server adapter translates pages into `(limit, offset)` and exposes the returned total.
The Post, Page and Work API handlers order by `version DESC`, count the stored rows, and return
`total`, `limit`, `offset` and `has_more`. The installed TypeScript contract uses int32 pagination fields.
The 100-row limit is a web request page-size limit, not a limit on the number of retained versions.

`useVersionHistoryQuery` requests consecutive pages until the latest total is reached.
It uses the requested page offset, rather than the number of deduplicated rows, to calculate continuation.
It removes repeated IDs caused by mutable offset boundaries while keeping the loaded order.
An empty response stops continuation. If total metadata is absent, only a full 20-row response continues.
Requests carry an AbortSignal, duplicate pending continuation requests share the same query, and errors
retain earlier rows. A failed page requires explicit retry; it does not start an automatic request loop.

Inspected local source on 2026-10-12:

- Client and route: `lib/client/version-history.ts`, `app/api/version-history/[entityType]/[entityId]/route.ts`,
  `lib/server/version-history.ts`.
- Contract: `geul-event-contracts/proto/api/common/v1/common.proto:31` and the Post/Page/Work version messages
  in `proto/api/manage/v1`.
- Listing: `geul-api/internal/post/versions.go:73`, `page/versions.go:26`, `work/versions.go:27`.
- Checkpoint creation compares the latest snapshot, skips identical content, and otherwise increments
  the version number and inserts a row: `post/internal_service.go:699`, `page/internal_service.go:760`,
  `work/internal_service.go:581`.
- Owner deletion removes its history: `post/service.go:615`, `page/service.go:522`, `work/service.go:693`.
  The corresponding schema foreign keys use `ON DELETE CASCADE` at `geul-schema/schema.sql:9341`, `9201`, `10237`.

No implemented per-history count or age cap was found in the inspected local API, schema, contracts and
deployment source. The audit included checkpoint creation, registered scheduler/worker jobs, version-table
deletion, retention, prune, TTL and maximum-history settings. Generated code, vendor code, tests and secret
configuration were excluded from that policy search. Live database jobs and external cleanup were not inspected.
Version counters and pagination metadata use int32/SQL integer fields. This is not a claim of unlimited
storage on the deployed server.

## States and review

| Story                                                                                                                                 | Task                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [Populated](http://localhost:6010/?path=/story/feature-version-history-versionhistorydrawerview--populated)                           | Inspect metadata, select Restore, cancel and return focus to its row              |
| Empty                                                                                                                                 | Explain why no checkpoint exists                                                  |
| Loading / Initial Error                                                                                                               | Await the first page or retry its bounded failure                                 |
| [Automatic Continuation](http://localhost:6010/?path=/story/feature-version-history-versionhistorydrawerview--automatic-continuation) | Scroll through three fixture pages without a persistent load-more button          |
| Loading More / Page Error                                                                                                             | Keep loaded rows while the next page is pending or failed; retry that page        |
| Restore Locked                                                                                                                        | Read history while restoration is unavailable                                     |
| Restore Confirmation / Restoring                                                                                                      | Review the source-locale effect and keep the owned operation locked while pending |

The View stories simulate service data and restoration callbacks. Automatic Continuation uses the actual
View and Core loader with three 20-row fixture pages. Controller and query tests exercise the actual query
and HTTP client with controlled responses, including more than 100 retained rows, failure recovery,
entity isolation and request cancellation. These checks do not prove deployed permissions or a successful
live restore.

Review at mobile, tablet and desktop widths with every named theme and locale. Check that the header stays
visible while the body scrolls, titles can shrink beside the right action, metadata wraps without horizontal
overflow, and appended rows preserve earlier entries. Check automatic loading, end feedback and explicit retry.
Verify the restore warning, pending lock and focus return separately. Browser axe and manual keyboard results
must be recorded with their actual scope; no VoiceOver or Orca result is implied by unit tests.

## Source and compatibility

- Controller: [VersionHistoryDrawer](../../features/version-history/VersionHistoryDrawer.tsx).
- Query: [useVersionHistoryQuery](../../features/version-history/useVersionHistoryQuery.ts).
- View and fixtures: [VersionHistoryDrawerView](../../features/version-history/ui/VersionHistoryDrawerView.tsx)
  and [stories](../../features/version-history/ui/VersionHistoryDrawerView.stories.tsx).

The View now requires initial error/retry and pagination props. Pagination contains the entity context key,
next numeric page or null, pending/error state and an awaited loading callback. Labels include continuation,
bounded load failure, end and retry. Row models include the ISO timestamp alongside relative and absolute text.
The production controller and all shipped View fixtures migrate together. Restore payloads and permission
rules are unchanged. Regenerate the Storybook documentation through the shared design-system workflow.
