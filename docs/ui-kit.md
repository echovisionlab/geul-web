# Geul design system in Storybook

Storybook contains the system rules, component contracts and page documentation alongside
running production Core controls and Feature views. The application and Storybook share
`DesignSystemProvider`, locale messages and generated token CSS. Fixture state resets on remount.

Tokens in `components/core/design-tokens.ts`, `theme.ts` and Core source own the adopted
contracts. Storybook presents those contracts and the evidence needed to review them.
The [system guide](./design-system.md), [component documentation](./design-system/component-documentation.md)
and [page documentation](./design-system/page-documentation.md) define the documentation requirements.
Use the Docs tab for purpose, API, supported states, content, responsive behavior and
accessibility contracts; use the Canvas tab to exercise the actual implementation.
Docs and previews must link to the same source owner and consumers.

## Run

From `geul-web`, run `pnpm storybook` on port 6010. To use another port, run
`pnpm storybook --port <port>` and use that origin for preview and test commands.
For a static build, run `pnpm storybook:build`, then `pnpm storybook:preview`.
The preview server defaults to port 6010; `UI_KIT_PORT` overrides it.
Build output and tool caches are disposable and are regenerated when needed.

## Inspect

Start at **Foundations / Overview** for the system rules and generated catalog.
Read the relevant foundation and component documentation before changing a page.
Use the Theme and Locale toolbar controls and the Phone, Tablet or Desktop viewports.
Use Controls for fixture states; Reload story resets edits.

The sidebar has six roots: Design System, Foundations, Core, Composition, Feature and Pages.
Design System contains the handbook, component/page catalogs, usage comparisons and pattern documentation.
Core and Feature use `root / category or domain / component`; Pages uses
`Pages / area / view`, with complete editor previews grouped under `Pages / Editors`.
Foundations and Composition list their subjects directly. Each subject has one story
file and one title. Fixed states and interactive playgrounds are named examples within
that entry, rather than separate `States`, `Interactive` or `Contracts` folders.

Component stories live beside their source in `components/core` or `features`.
Cross-component examples live in `stories/foundations`, `stories/compositions`,
`stories/features` and `stories/pages`; their shared fixture adapters live in
`stories/shared`. `check-story-catalog.mjs`, included in `design-system:check`, rejects
duplicate titles, repeated path segments, unnecessary nesting and broken fixture links.
Story URLs follow these titles; regenerate the inventory after renaming an entry.

[Generated inventory](./design-system/generated-inventory.md) lists current source owners and stories.
[Route coverage](./design-system/route-preview-coverage.md) records each preview's scope.
[Page coverage](./design-system/page-preview-coverage.md) tracks public pages and query-selected
editor branches separately. [Feature coverage](./design-system/feature-preview-index.md) lists view-level coverage.

The [accessibility release readiness matrix](./design-system/release-readiness.md) defines
the ordered review of all actual pages, conditional views, Core families and feature kinds.
It preserves current visual design and displayed wording; a preview mapping is not a completed check.

## Loading review

Read the [common loading contract](./design-system/loading-surface-contract.md) and
[consumer migration](./design-system/migrations/loading-commonization.md) before reviewing a wait.
Use these source-backed entries to compare the shared presentation with actual consumers:

| Entry                                                                                                                                                                    | Review scope                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Core/Feedback/PageLoaderView](../components/core/LoadingSurface/PageLoaderView.stories.tsx)                                                                             | Required visible text, failed image and `FlowRegion` with content before/after the wait                                                                    |
| [Feature/Site/PageLoader](../features/site/PageLoader/PageLoader.stories.tsx)                                                                                            | Manifest fixture, generic/phase text, no image, failed image and placement Controls                                                                        |
| [Foundations/Catalogue Boundary](../stories/foundations/CatalogueBoundary.stories.tsx)                                                                                   | Bootstrap pending, configured image, failed image and retry before ManifestProvider                                                                        |
| [Feature/Page/Block Loading](../features/page/blocks/BlockLoading.stories.tsx)                                                                                           | Grid/list, authors, map and table region geometry                                                                                                          |
| [Feature/Data Table/Server Navigation Wait](../features/data-table/ServerDataTable/ServerDataTablePending.stories.tsx)                                                   | Filter/sort/page navigation, error recovery and retained rows with a manually settled local Promise                                                        |
| [Core/Actions/TextButton](../components/core/TextButton/TextButton.stories.tsx), [Core/Data Display/TableRowMenu](../components/core/DataTable/TableRowMenu.stories.tsx) | Controlled command pending and returned-Promise tracking                                                                                                   |
| [Core/Input/MultiSelectComboboxView](../components/core/Input/MultiSelectComboboxView.stories.tsx)                                                                       | `Loading`, `LoadingEmpty`, `Creating`, `DisabledPending`, `CreationRetry`: checking feedback, retained selection and creation gating                       |
| [Core/Overlays/ConfirmModal](../components/core/Modal/ConfirmModal.stories.tsx)                                                                                          | `QueuedConfirmation` uses eager loading with required localized `loadError`; `RendererLoadError` renders the actual recovery view with local no-op actions |
| [Feature/Auth/Login Flow](../features/auth/LoginFlowView.stories.tsx), [Feature/Auth/Verification Flow View](../features/auth/ui/VerificationFlowView.stories.tsx)       | Retained PIN submission, isolated resend pending, retained applying/unavailable result during authority rechecks                                           |
| [Feature/Page/Tool Startup](../features/page/blocks/embed/ToolStartup.stories.tsx)                                                                                       | Production PageContentView/EmbedFrame/ToolModule pending, failed, ready and `Mobile` 320px region; local external mount fixture, real site loader          |
| [Feature/User/ProfileAvatarControl](../features/user/ui/ProfileAvatarControl/ProfileAvatarControl.stories.tsx)                                                           | Image removal at profile/admin sizes, disabled state, shared media-overlay glyph and pending treatment                                                     |

The loader image fixtures default to static local images; failed-image examples request a missing local GIF.
Use loader Controls with the observed public GIF to inspect delivery and playback. A supplied map
`rendering` phase demonstrates supported copy, not an observed runtime transition.
Check containing regions, retained content, error/retry, focus, theme, locale and viewport separately.
Normal Storybook preview preloads on-demand overlays, so it cannot by itself establish cold-chunk
feedback or exhausted host retries. Tool startup fixtures control the module's `mount()` Promise;
they do not delay module download or contact real tool services. Server navigation retains existing
rows by default; an empty pending table can still use PageLoader.

The coordinator reports direct visual inspection of the actual Works GIF and live PortaDJ ready
state. Storybook observations cover common-loader GIF phase/generic text, no-image/failed-image
cases, tool pending/failed/ready and the 320px region, and the `33steps` avatar plus hover.
This documentation pass did not run browser checks. Most other production/Storybook states,
physical coarse-pointer input and actual assistive-technology announcements remain unverified.
Source links and play functions are review locations, not execution results. These observations
record no released web version or blanket visual approval.

## Editor pages

`Pages` includes Post, Page, Work, Artist, Label, Release, Program Event, Program Event Series,
Form Builder, Terms and Privacy editor previews, plus the Campaign editor.
Document editor fixtures use local canonical Yjs documents and a provider with networking disabled.
They render the production editor views, with local metadata and connection/permission states.

These previews cover layout and local editing. Uploads, relation management, authorization,
server persistence and route loading require application verification. The Form preview covers
the builder; settings, submissions and translations have separate coverage requirements.

Service-backed authoring extensions without local adapters are omitted from the composed
editor previews through `AuthoringExtensionsProvider`. Production editors enable these
extensions by default and retain their permission checks. Dedicated view stories with local
callbacks still cover sharing, uploads and translation controls. OG configuration previews
retain local save/reset controls and omit the unavailable generation service. Place previews
use editable names, addresses and coordinates without loading external map services.
Storybook route navigation
opens existing catalog entries and retains Theme and Locale selections.

## Validate

Run `pnpm storybook:typecheck` and `pnpm design-system:check` after source changes.
Generate the current catalog with `node scripts/design-system/inventory.mjs`,
then `node scripts/design-system/page-preview-coverage.mjs` and
`node scripts/design-system/feature-preview-index.mjs`.
The [toolbar guard](./design-system/storybook-toolbar-guard.md) documents shared locale/theme ownership.

Use `node scripts/design-system/review.mjs run compact-product` for the saved product review plan.
`status compact-product` reads the current checks; `record compact-product` publishes passing,
current evidence after the manual notes are updated. See the [review tooling guide](./design-system/review-tools.md).
Plans live in `design/storybook/review-plans/`; execution outputs use the stable ignored
`.artifacts/design-system/reviews/<name>/` directory. Reuse this tool instead of recreating temporary scripts.

## File browser verification

The [file browser guide](./design-system/file-browser.md) defines Core sizing and selection
contracts, navigation roots and the current API role policy. Core Selection Surface stories
cover automatic, explicit and responsive column counts. Editor File Library Picker form stories
use real form fields and show reports only on Add and Submit. Verify both grid and list in Phone,
Tablet and Desktop viewports, themes and locales before changing consuming screens.

File browser review includes independent icon sizing, fractional grid cells and the shared View settings popover. See [file browser contracts](./design-system/file-browser.md) for OS references, selection/navigation rules and consent-aware local persistence.

File browser Core examples use the same file appearance as the production grid: Grid Columns combines automatic/fixed/responsive controls in one story, and File Icons covers file types. Folder Navigation shows matching parent/view
action sizes and a scoped root without an up action. Native Range covers automatic, explicit and
disabled slider values. The guide's ownership table links each definition to its consumers.

File lists in File Manager and Editor File Library Picker share `FileBrowserListView` and Core `DataTableView.mobileLayout="inline"`: one vertically centered row, trailing short format/size, filename ellipsis, and size-only metadata below the container `sm` breakpoint. See [the file browser contract](./design-system/file-browser.md).

Collection and table controls share Core `ToolbarLayout`; `SelectionToolbar` and both DataTable toolbar adapters consume it. Search/filter inputs inherit compact density. Table selection geometry is Core-owned. See [tables and toolbars](./design-system/tables-and-toolbars.md).
