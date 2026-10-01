# UI library architecture

The application UI has four explicit layers. Dependencies flow in one direction:

```text
components/core -> features/<domain>/ui -> feature controller -> app
```

File placement follows semantic ownership, not visual size, composition depth, or the number of
call sites. `shared`, `common`, and `patterns` are not valid catch-all ownership domains.

## Core

`components/core/**` contains domain-free UI primitives and domain-free composed UI such as a
generic `DataTable` or `Modal`. `components/**` must contain only this `core` subtree; every other
component belongs to a named feature.

- Receives all visible copy, values, state, and event handlers through props.
- Must not import app routes, features, generated contracts, API clients, auth, queries, mutations,
  notifications, or translation providers.
- Owns visual tokens and semantic control APIs. Consumers use `tone`, `emphasis`, `appearance`,
  and `shape`; Mantine `color`, `variant`, and `radius` are implementation details.
- `PageHeader` owns the shared route-title scale and separates semantic `h1|h2` level from visual
  size. `SectionHeader` remains the compact heading for controls grouped inside a page, while
  content heroes and editor titles keep their dedicated Feature/Core owners.
- May use React, Mantine internals, browser interaction state, and local pure utilities.
- Composition alone does not make a component feature-specific. A composed control belongs here
  when every displayed value, label, state, and event is supplied by props and its API has no
  domain vocabulary.
- May use `next/link` as a declarative anchor transport when the destination and navigation props
  are supplied entirely by consumers; route selection and router state remain outside Core.
- `TextButton.size` owns typography only. `controlSize` opts into control hit-area geometry; composite
  controls may override the typed `--text-button-*` style variables when their surrounding layout
  owns an established row height or padding contract.
- Storybook gives each primitive its own `Core/<family>/<component>` group and separate state
  stories. Cross-component examples live only under an explicit `Composition` subgroup; primitive
  catalogs must not be collapsed into one all-controls story.

## Feature UI

`features/<domain>/ui/**` contains domain-shaped, pure UI composed from Core.

- Receives labels and serializable view models through props. It must not expose generated API,
  repository, query, session, or router types in its public props.
- Emits user intent through callbacks.
- May own local presentation state, but does not fetch, mutate, navigate, translate, notify, or
  read session state.
- Stories under `Feature/**` render this layer directly without mocking a backend.
- External-video URL resolution is owned by `features/media/external-video.ts`, while the pure
  iframe/fallback presentation is owned by `features/media/ui/ExternalVideoView.tsx`. The resolver
  has no DOM or translation dependencies.

## Feature controllers

Controllers and hooks outside `features/<domain>/ui/**` connect Feature UI to service behavior.

- Own API calls, repository access, queries, mutations, upload policy, translation lookup,
  notifications, routing, and session refresh.
- Convert service models into the view models consumed by Feature UI.
- Convert UI callbacks into service commands and expose pending/error state as props.

## Page composition

`app/**` loads route data and composes controllers. Route-level compositions are verified through
their controller and view unit tests; they are not registered in Storybook.

- Route modules should not invent a second visual implementation for a Core or Feature control.
- A route-to-story inventory in `docs/ui-inventory.md` records every served page and its UI owner.
- `docs/ui-component-inventory.md` records every remaining direct interactive dependency and the
  migration gate required before it can be banned outside Core.
- Page `external-video` sections own only the shared URL/aspect-ratio and localized caption wiring.
  Post and Page rich-text public views, including generated localized Post/Page documents, may promote an exact
  standalone YouTube/Vimeo link; Work, Event, nested rich-text children, and the global `DefaultBlockView` do not
  own that promotion.
- Post/Page rich-text editors apply the same promotion through the editor-only
  `ExternalVideoPreviewExtension` decoration. The underlying paragraph/link and Markdown output
  stay ordinary; only preview width, aspect ratio, and existing text alignment are persisted.

## In-editor AI

The Tiptap AI surface is a Browser Session client of the generated
`AIEditorOrchestrationService`; it is not Remote MCP and does not call a provider from the browser.
Every turn carries an exact document type, entity ID, locale, shared document revision, optional
existing-target revision, and stable Block handles. Web consumes assistant text and typed approval events from `StartAIEditorTurn`, then uses
`ResolveAIEditorToolCall` or `CancelAIEditorTurn`. It never applies the approval mutation through
`AIDocumentService` directly and never interprets provider output as HTML or ProseMirror content.

Source-locale editors may open document-level generation and selected-text modification. A
locale-owned editor with neutral structure locked may open AI only for selected supported text;
the server remains authoritative for rejecting any operation outside that locale's field ownership.

Post Summary generation uses the same exact-locale orchestration turn. The card approves only one
catalog-known `document.summary` text replacement for its requested Post and locale; it never
applies a browser-generated suggestion through the deprecated metadata-job path. Missing target
rooms and read-only viewers receive no AI target. Page, Work, and Program Event Summary AI remains
hidden until each domain exposes the same exact locale and revision authority.

One-step `Cmd-Z` for an accepted server-origin mutation requires the Collaboration relay to mark an
exact accepted mutation with its Member, locale, document revision, optional target revision,
operation batch, and one-shot tracked origin. The current Web P0 does not manufacture a local
ProseMirror transaction or claim undo before
that event-contract → common applicator → API publisher → Collab relay → Yjs UndoManager boundary
exists. Delayed translation delivery must not use that tracked origin.

## Ownership examples

- Data tables: generic table layout, controls, and selection surfaces live in
  `components/core/DataTable`, including the prop-driven `DataTableView`. Repository/query mapping,
  URL navigation, translation, and server-table behavior live in `features/data-table` or in the
  feature that owns the domain rows.
- Maps: `features/map/MapLibreMap.tsx` is the translated controller facade,
  `MapLibreMapRuntime.tsx` owns browser and map-instance behavior, and `features/map/ui` contains
  prop-driven map views. Place/location-specific views and controllers live in their owning
  `features/place` or `features/location` domain. They do not move to Core merely because several
  pages use them.
- Media: pure media surfaces live in `features/media/ui`; hydration and player/runtime behavior
  live outside that `ui` directory. Editor-only media framing belongs to `features/editor/ui`.
- Authoring headers: the domain-free composed header lives in `components/core/EditorHeader`; the
  translated controller and status helpers live in `features/authoring/EditorHeader`. Legacy
  `features/editor/EditorHeader` entrypoints are compatibility re-exports, not a second owner.
- Image upload and crop: `components/core/ImageUpload/ImageUploadCropField` owns the reusable visual
  surface, `features/upload/ImageUploadCropController` owns selection policy and browser-side image
  preparation, and each consuming feature keeps its own persistence mutations.
- Site assets: the pure upload surface lives under `features/site/**/ui`; upload policy,
  validation notifications, and mutations stay in its feature controller.
- Document layouts: `features/document-layout/ui` owns the contract-free layout view model and
  prop-driven field/view composition. The feature entrypoint maps the collaboration contract to
  that view model and exposes contract-facing helpers to controllers and page composition.
- Version history: `features/version-history/ui` owns the prop-driven drawer surface. Its feature
  controller owns version requests, translations, notifications, locale-aware date formatting,
  and service-model mapping.
- Data-table composition keeps `DataTableContext` independent from the compound root. Client state
  and URL-backed server state are adapters around the same prop-driven sort view; the view does not
  read routing or query state.
- Recursive Page blocks receive their child-section renderer from the PageEditor composition
  boundary. A block implementation must not import the registry through `SectionContent`.
- Page section insertion menus use `PageEditor/section-menu.ts` for presentation order and
  `usePageSectionTypeLabels` for labels. Column menus retain their allowed subset in the same order.
- Upload lifecycle and image-asset replacement are owned once in `features/upload`; domain editors
  provide validation, persistence, and labels instead of reimplementing the same state machine.

When a component is reused across domains, choose the feature that owns its meaning. Reuse does not
justify a new global folder, and “composed” does not mean “feature-specific.”

## Tests

- Core unit tests verify semantic props, accessibility, and state behavior.
- Feature stories cover empty, populated, loading, error, disabled, and destructive states through
  serializable props and callbacks. Stories do not import actions, queries, router controllers, or
  collaboration providers, and they do not mock those modules to turn an integration surface into
  a component.
- State transitions, branching, callbacks, and data mapping require unit coverage; a browser flow
  must not substitute for a missing unit test.
- Storybook is a visual catalog of fixed, props-only Core and Feature UI states. Story modules do
  not own `play` assertions, local controller hooks, service contracts, providers, or runtime
  harnesses.
- CI validates and builds the catalog but does not execute every story in a browser. Component
  behavior, callbacks, accessibility, branching, mapping, and state transitions belong to Vitest.
- There is no production E2E suite, Storybook browser runner, Playwright dependency, manual-story
  exception, or page/runtime story registry.

ESLint enforces that `components/**` contains only `core`, protects Core and Feature UI dependency
boundaries, and rejects direct Mantine interactive controls outside Core. Relative imports may
compose siblings inside the same Core or feature `ui` subtree but may not escape that boundary;
Feature UI also cannot import locale/message modules or any `@echovisionlab/*` domain contract directly.

## Public legal document loading

`/privacy` and `/terms` use `lib/queries/legal-public.server.ts` to read the current
and scheduled versions once per requested locale and render request. React request
memoization does not persist a policy version across requests.

`features/policy/public-legal-page.server.ts` derives the title and summary from that
snapshot so metadata, JSON-LD, and the initial document use the same version.
`lib/queries/legal-public-page.ts` owns the shared wire-to-view projection; browser
and server reads use the same content, localization and date mapping.

The client consumes matching-locale initial data in one combined query. It uses the
Query provider's existing 60-second freshness window and the server read timestamp,
so mounting fresh data requires no browser RPC. A newer server snapshot also takes
precedence over older browser data on a return visit. Missing server data remains eligible
for a browser retry; an authoritative empty response renders the empty state, while
a query failure renders an error. ShareLink previews retain their exact version ID,
token and locale query, and never consume a public initial snapshot. History queries
retain their existing interfaces.

### Measured loading verification (2026-10-01)

Compared the two page client modules at `f1e21bf2456ebbf62e19122cfaabe2e0c049f679`
with this change using the same React/Vitest/JSDOM fixtures, English locale, one
published paragraph, empty query cache and the existing 60-second freshness window.
Only the baseline page modules were swapped; query mocks and rendering fixtures
were identical. Both pages changed as follows:

| Measurement                          | Before | After |
| ------------------------------------ | -----: | ----: |
| Initial client query function calls  |      2 |     0 |
| Published paragraphs in initial HTML |      0 |     1 |

The initial client query calls dropped by 100%. When the server snapshot is unavailable,
the client now invokes one combined query; the query boundary test verifies exactly
one `get({})` RPC for both current and scheduled values.

These are deterministic query/HTML measurements, not real network timings. Production
LCP and CLS have not been measured for the changed version because it has not been
deployed; the local-contract build uses local service endpoints, not the audited live
site's content. Actual layout and timing improvement needs the same browser/cache
conditions as the public-page audit after deployment. The alternatives verified here
are real paragraph SSR, hydration preserving the server DOM, query counts, locale and
ShareLink isolation, return visits with older or pending browser data, and authoritative
empty versus service failure behavior. Server request-cache tests model React's cache
semantics and do not constitute production RPC tracing.

## Public runtime loading boundaries

Public route compositions import a domain-owned `Lazy*Editor` client entrypoint. That
entrypoint owns the editor's `next/dynamic` import; permissions, redirects and edit
props stay in the server route. Editor SSR remains enabled. Importing an editor
dynamically from a server component alone does not establish this client boundary.

Generated and legacy rich-text dispatchers keep text, headings, lists and tables
synchronous. Math, maps, diagrams, code and executable blocks own separate dynamic
modules with SSR enabled, preserving document HTML and printable source. Generated
file blocks own their media implementation separately. Download authority, durable
attachment state and missing-media presentation are preserved by those modules.

The root layout owns Mantine Core, notifications, spotlight and document styles.
Dates, charts, carousel, KaTeX and Video.js vendor styles belong to actual feature
consumers. Math modules import KaTeX; both the video player and legacy media hydrator
import Video.js. Storybook retains its independent preview styling.

`MapViewEmbedded` starts the shared runtime import when a map is needed, overlapping
its theme query. The dynamic renderer reuses the same promise. Empty unused maps do
not start it, and failed imports can be retried. Map workers retain their existing
runtime lifecycle; bounds-dependent data requests are not deduplicated across
unequal bounds.

`page-public.server.ts` owns the raw Page response within one React request, keyed
by decoded slug and requested locale. Homepage and Page metadata/body mapping share
that response. Source-locale fallbacks use a different locale key, and each caller
retains its existing empty/not-found/error policy.

Anonymous visits to the six measured public routes receive a smaller translation
catalogue. Authenticated and other initial routes receive the full catalogue.
Public media/executable messages in `editorCommon` remain available. Because root
layouts persist across navigation, `ClientMessagesProvider` restores the current
locale's full catalogue before rendering another route. It retains a loaded full
catalogue for later navigation and never reuses it for another locale.

Same-condition measurement and limits are recorded in
`docs/public-loading-performance.md`. Source dependency boundaries are not a
substitute for initial network-transfer measurements.
