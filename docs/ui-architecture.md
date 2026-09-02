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
