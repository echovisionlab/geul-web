# UI component inventory

Baseline snapshot: `2026-07-11 20:36 KST` on `fix/profile-avatar-control`.
Migration status notes were updated on `2026-07-19` from `fix/text-button`.

The baseline inventory is the exhaustive component-side companion to `docs/ui-inventory.md`. It covers all
1,587 JavaScript and TypeScript source files outside `components/core/**`, `stories/**`, generated
code, and vendored dependencies. The inspected import manifest SHA-256 is
`8b55f8bf0597c23b48a3c2b42adef8f8c317fc4eb09ed52e6ccb84a14086d0d0`.

Those counts and the manifest hash describe the baseline only; the migration notes below describe
the current ownership state and are not a regenerated exhaustive import snapshot.

Housekeeping update (`2026-08-09`): repeated Core input class construction now has one owner;
fourteen Admin modal contexts use one typed factory; DataTable context no longer cycles through its
compound root and client/server multi-sort use one view; Page Columns receives recursive rendering
from PageEditor composition; image upload lifecycle, editor media drop handling, share-password UI,
active editor locale controls, and map-feature query projection each have one implementation.
Source-text, file-presence, and negative-import tests were removed; architectural correctness is
kept by dependency direction and observable unit behavior instead.

ShareLink validation and `/s/{token}` destination selection belong to server route/query controllers, not a visual component or Storybook-only branch. Public Artist, Label, legal-document, content, and form views keep their production Feature/Core composition; token previews only alter the controller query and cache/index/referrer policy.

Counts use `consumer files / JSX root instances`. Hooks and compound-only APIs are called out
separately.

## Canonical controls

The following Mantine value imports have reached zero outside Core:

- `Tabs`, `Button`, `ActionIcon`, `ThemeIcon`, `Badge`, and `Card`.
- `TextInput`, `Textarea`, `Select`, `MultiSelect`, and `PasswordInput`.
- `Checkbox`, `ColorInput`, `FileInput`, `NativeSelect`, `NumberInput`, `PinInput`, `Radio`,
  `SegmentedControl`, `Slider`, `Switch`, and `TagsInput`.

Current canonical Core reach is `Button 126 files`, `IconButton 81`, `Badge 87`, and `Tabs 8`.
There are no surviving local button or badge primitive duplicates.

Core `EmojiPicker` is the editor-agnostic controlled selection surface: Mantine owns layout and scrolling,
while Core `ContentModal`, `TextInput`, and `IconButton` own interactive styling. It receives only query,
display items, and callbacks. The Tiptap Feature adapter owns `@tiptap/extension-emoji` data, filtering,
Slash anchor validation, and editor insertion; Core does not import Tiptap or collaboration types.

Core `DateTime` is the canonical pure semantic timestamp renderer and receives resolved locale and IANA time zone
props. The DateTime Feature adapter connects it to the request Session geo projection, so SSR and hydration use
the same validated zone; an absent or invalid zone falls back to UTC. Features reuse that adapter or its formatter
hook instead of calling browser-local `Intl` APIs. A domain-owned zone overrides the request zone only where the
value itself owns that calendar meaning: Program Event start/end and Post scheduling use their stored or selected
IANA zone, while Release date-only values use UTC to preserve the stored calendar date. Core `DateTimeInput`
remains a local wall-clock input primitive and does not convert its value into an instant.

## Styling boundary

Core and Mantine semantic primitives are the first styling boundary. Mantine props own simple
layout. A component uses `classNames` with a CSS Module for its selectors, state, pseudo-classes,
responsive rules, and NodeView styling. Global CSS is reserved for root, vendor, print,
materialized prose, and externally generated DOM; component-specific global `.mantine-*` overrides
are not permitted.

The CDN supplies Noto Sans, Noto Sans Mono, Noto Color Emoji, and the active locale profile
(KR, JP, SC, TC, or Arabic). Mantine owns the corresponding sans, monospace, and heading families.
Mantine blue is the interaction primary for links, controls, focus, selection, and editor affordances;
danger remains semantic red. Site Settings `primary_color` is independent branding projected as
`--geul-brand-color` for site identity, metadata, and generated sharing assets.

Basic materialized and Tiptap document blocks use the same Mantine font-size, heading, line-height,
spacing, border, anchor, and dimmed-color tokens through the narrow generated-DOM bridge
`lib/styles/document-content.css`. `.prose` remains only a public document-container hook; there is
no global `prose.css` style authority. Editor canvas padding, selection, handles, NodeViews, Feature
runtimes, and responsive composition remain CSS Module or Feature-owned CSS responsibilities.

p5.js, Three.js, and Shader authoring/public renderers share the engine-neutral executable title and
one runtime/source action row. `ExecutableBlockTitle` edits the locale-owned authoring title and renders
the localized public title with an engine-label fallback; the header contains no duplicate edit/source/
preview mode controls. Editable executable titles use the zero-radius Core TextInput with its form
underline animation disabled for this compact header context. A ChevronDown/ChevronUp control expands
or collapses Monaco beneath the always-visible preview. Stop/run, restart, source disclosure, reset,
copy, and Apply stay in the same non-wrapping transparent Core IconButton row. Authoring Apply writes
the draft through the document/Yjs source boundary; public Apply changes component-memory preview state
only and never persists. Authoring reset discards the unapplied draft to the current document source;
public reset restores the published source. Both surfaces use the same single outer box with no body/
figure padding or title-row bottom border. Three.js authoring and public previews also use the same full
preview canvas bounds so their camera aspect, background, and scene alignment do not diverge.

p5.js camera, microphone, motion, MIDI, gamepad, serial, location, and Bluetooth access is an explicit
Shared-block capability, not inferred from source and not translated. A device-capable sketch stays stopped
until the author or visitor presses Run; the row
shows the declared device indicators before that action. Device-enabled source, including public temporary
edits, runs only in the configured cookie-less runner origin on a different registrable domain. The iframe
does not receive `allow-same-origin`, does not execute a same-origin `srcdoc`, and sends source only after an
exact runner-origin/channel handshake. The browser remains the permission authority. Stop, tab deactivation,
unmount, runtime failure, and runner disposal close acquired MediaStream, MIDI, serial, and Bluetooth GATT
resources. Serial and Bluetooth device selection must begin in a trusted sketch pointer or keyboard handler.
A denied or unavailable device returns the block to stopped/error state. p5.js blocks without device
capabilities retain their existing opaque-iframe automatic execution.

The default Three.js source starts with a visible `import * as THREE from 'three';` line. The
editor resolves that module through Monaco's local type contribution, while the runtime removes
only that exact built-in import before executing the source with its existing scene context. p5.js
continues to use its documented global mode and therefore does not add a synthetic import line.

Code block authoring and public rendering share one title/language/Monaco surface and one header copy action.
The title is locale-owned content with the localized Code Block label as its empty fallback; public Monaco is
read-only, while authoring enables source and title input only under localized-content authority. Under neutral
block authority, the authoring header language label opens the supported-language menu; public rendering keeps it
as metadata. The language trigger is a zero-radius Core Button targeting the zero-radius Core DropdownMenu. The
standalone Code Block Authoring Story covers this interaction in addition to public comparison.

The Tiptap and public Map renderers accept zero places and still render the full stored viewport.
Map Place management adds optional markers; it does not replace an empty map with a compact
placeholder.

Table cell text selection remains a `TextSelection`: each horizontal Shift+Arrow press extends or
contracts the selection by exactly one character inside the current cell. CellSelection is reserved
for explicit row, column, and table selection commands, and text selection does not cross a cell edge.

Public Client lists use the Client logo as the single external website link when a logo is available;
they do not repeat the Client name beside the linked logo. The linked name is the fallback only when
the Client has no logo. Authoring and administration may retain the name beside a logo for identification.

Editor color names are durable document values; `lib/styles/variables.css` owns their light/dark semantic text and background tokens for authoring controls and materialized prose.

Compact editor toolbar tooltip content is Feature-owned at `features/editor/toolbars`: it pairs the
localized action name with a subtle platform-adaptive shortcut only when that editor command exists,
opens on pointer hover and keyboard focus, and does not change the action's accessible name.
Alignment actions retain their direct localized names while showing the shared
`Ctrl-Shift-ArrowLeft`/`Ctrl-Shift-ArrowRight` cycle pair as one `Ctrl ⇧ ←/→` hint on every BubbleMenu.

## Remaining interactive imports

| Family                    | Direct imports outside Core                                                                                                                                    |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overlay and help          | `Tooltip 44/85`, `Modal 41/62`, `Drawer 8/8`, `Popover 6/6`, `FloatingWindow 1/2`                                                                              |
| Navigation and actions    | `Menu 21/24`, `Anchor 12/17`, `UnstyledButton 11/15`, `Pagination 9/9`, `Accordion 4/5`, `Burger 2/3`                                                          |
| Composite input internals | `useCombobox 11 files`, `Combobox 10/10`, `InputBase 9/10`, `Input 4 files`, `PillsInput 1/1`, `FileButton 1/3`, `CopyButton 1/2`, `Pill 1/1`, `CheckIcon 1/1` |
| Semantic presentation     | `Paper 42/70`, `Alert 30/59`, `Progress 8 files/10 roots plus 9 compound uses`, `Indicator 4/4`                                                                |

Layout, content, and provider primitives remain valid direct Mantine dependencies. The most common
are `Text 287`, `Stack 245`, `Group 187`, `Box 132`, `Title 69`, `Divider 45`, `Loader 41`,
`SimpleGrid 32`, `Avatar 22`, `Center 18`, `ScrollArea 15`, `Table 14`, `Collapse 13`, and
`Container 12`.

### Page and section typography audit

The 2026-08-05 working tree still has 120 direct Mantine `Title` roots across 64 App/Feature files.
Page titles are split between raw `Title`, Feature `AdminPageHeader`, Core `EditorHeaderView`, and
domain content headers. Heading order often controls both document semantics and Mantine's visual
size, while 13 public/editor paths separately force the convergent `1.5rem` page-title scale.

| Surface                     | Current owner                             | Current title scale                                         | Semantic result                                        |
| --------------------------- | ----------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------ |
| Public detail and editor    | Direct `Title` or Core `EditorHeaderView` | Usually `1.5rem`, with unbounded raw defaults still present | Usually `h1`                                           |
| Admin list page             | Feature `AdminPageHeader`                 | Mantine `h2` default, `1.625rem`                            | `h2`; Admin shell supplies no preceding `h1`           |
| My page                     | Direct `Title order={2}`                  | Mantine `h2` default, `1.625rem`                            | `h2`; My shell supplies no preceding `h1`              |
| Login and verification      | Direct `Title` order 2 or 3               | `1.625rem` or `1.375rem`                                    | `h2` or `h3`; General shell supplies no preceding `h1` |
| In-page control section     | Core `SectionHeader`                      | `sm` title and `xs` description                             | Visual grouping `div`, not document outline            |
| Shell and navigation chrome | Core/Feature chrome tokens                | `0.75rem`, section label `0.625rem`                         | Navigation labels                                      |

- Core `PageHeader` now owns the domain-free `1.5rem` route title, `sm` description, optional actions,
  and explicit `h1|h2` semantic level.
- Core `SectionHeader` remains a compact `sm` title with `xs` description inside an existing page.
- Core `EditorHeaderView` remains the authoring-specific title/control surface; content hero scale
  remains with its owning Feature.
- Direct Mantine `Title` is migration work, not a canonical new-feature pattern. It can be lint-banned
  only after page, section, content, form-state, and document headings have moved to the correct owner.

## Migration order

| Priority | Work                                                                                                    | Verified scope                                                                                                                                                |
| -------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0       | Finish Core modal and overlay APIs, including responsive dialog/drawer, popover, and floating surfaces. | `Modal 41/62`, `Drawer 8/8`; 48 raw modal instances repeat the same right-aligned action footer. Core `ConfirmModal` has 29 consumers and `FormModal` has 11. |
| P0       | Add Core menu, tooltip, and semantic trigger APIs.                                                      | `Tooltip 44/85`; 60 tooltip instances wrap `IconButton`. `Menu 21/24`; `TableRowMenu` already shields 24 downstream consumers.                                |
| P0       | Keep pure Feature UI behind semantic Core controls.                                                     | `ShellView` now uses Core `Disclosure` and `MenuToggle`; direct `Accordion` and `Burger` imports in the view are zero.                                        |
| P1       | Add semantic Core notice/alert and finish Paper-to-Section migration.                                   | `Alert 30/59`, `Paper 42/70`; Core cards already cover 80 `SectionCard`, 13 `ContentCard`, and 8 `StatCard` instances.                                        |
| P1       | Migrate route titles to Core `PageHeader` and close missing/duplicate heading levels.                   | Direct Mantine `Title 64 files/120 roots`; Admin, My, Auth, and Public routes do not yet share one page-title contract.                                       |
| P1       | Add Core pagination, disclosure/accordion, link, and shell navigation triggers.                         | `Disclosure` and `MenuToggle` now cover the former Shell `Accordion` and `Burger`; pagination and remaining link/trigger migrations stay in this workstream.  |
| P2       | Canonicalize copy/file actions, progress, and indicator.                                                | `CopyButton 1/2`, `FileButton 1/3`, `Progress 8 files`, `Indicator 4/4`.                                                                                      |

`components/core/Progress` now owns the semantic tone, square-radius, determinate, and indeterminate
progress contracts. The audio transcoder is its first consumer; the older direct Mantine progress
instances above remain migration work rather than exceptions for new feature UI.

`RouteProgressBar` in the same Core boundary owns the fixed, two-pixel route-transition indicator.
The client runtime starts it from Next.js `instrumentation-client.ts`, completes it when the rendered
pathname or search parameters commit, and never patches browser history or reserves layout space.
Page-, map-, editor-, media-, and upload-specific loading surfaces remain independently owned by their
existing Feature controllers.

`features/tools/youtube-audio` owns YouTube URL resolution and its pure Storybook states. It composes
Core `PageHeader`, `SectionCard`, `SectionHeader`, `Field`, `TextInput`, `Button`, `StatusBadge`, and
`Alert`, then passes the authenticated HTTP range source into the existing Audio Transcoder Feature;
it introduces no parallel conversion controls or new Core primitive.

ESLint restrictions are added only after a migrated symbol reaches zero direct imports. This keeps
the gate strict without suppressing unfinished work.

## Ownership migrations

- Post Series public presentation is owned by `features/series/SeriesPublicView`. The route controller owns locale resolution,
  generated → Featured Image → Site OG metadata fallback and URL-backed Post pagination; the Feature composes Core
  `PageHeader`, shared locale/share controls and the production Post table. Its Storybook states reuse that same pure view.
- Program Event Series public presentation is owned by `features/program-event`. The route controller owns the
  locale-neutral series read, localized Event query and direct Poster → Site OG metadata fallback; the client list
  controller owns filters and incremental loading. `ProgramEventSeriesPublicView` and
  `EventSeriesEventsTableView` are prop-driven production views reused by the network-independent Storybook states.
- Label OG visual comparison is owned by `features/metadata`. Its Storybook-only preview mirrors the
  worker's title-free 1200×630 canvas, fixed 720×315 production contain box, and representative logo
  aspect ratios; it does not introduce a second Label editor or a runtime Web renderer.
- Map Theme Admin UI is owned by `features/admin/MapThemeEditor`. `MapThemeListPageView` composes
  Core PageHeader, FormModal and ConfirmModal; `MapThemeListView` keeps cards
  non-interactive and exposes explicit edit links plus Core menu/tooltip actions. Default and last
  Theme deletion remain visible but disabled. The editor always exposes light and dark tabs, never
  seeds collaboration state from the manage read, and blocks edits until the authoritative Collab
  snapshot is synced. Permission loss, Session expiry, and revision conflict use separate Core
  blocking dialogs and keep their home, login-return, and reload results distinct. List and editor
  query failure use a localized Core alert instead of an empty or editable state.
- Canonical entity edit routing belongs to route controllers, not Feature views. Post, Page, Work,
  Artist, Release, Label, Form, and Program Event reuse one editor composition at the immutable
  `ID?edit=true` path for every authorized role; authorized legacy slug editor paths redirect there.
  Feature components receive allowed actions; they do not select an
  `/admin` or `/my` editor based on role. A valid unauthorized Session resolves to `404`. Page is the
  root-depth exception: exact `/works` is Page while `/works/{idOrSlug}` is Work.
- Core `EditorHeaderView` owns transient empty-title UX. It retains an empty input draft locally, renders the
  caller's entity-specific untitled placeholder, and emits only non-empty titles. Slug-owning Feature editors
  persist title and slug independently: title edits never drive slug generation, and only the URL field changes
  an existing slug.
- Release artwork UI는 기존 `ReleaseArtworkView`의 선택·교체·해제 상태를 유지한다. Public metadata controller는
  현재 artwork public asset을 모든 locale의 `og:image`로 직접 사용하고 artwork가 없으면 Site OG로
  fallback한다. 별도 Release OG generation 진행 상태는 UI나 Storybook 상태가 아니다.
- Core `BlockingAlertDialog` owns the non-dismissible `alertdialog`, focus trap, backdrop and
  background-free `info|warning|danger` level icon. Shared Editor dialogs own localized permission-revoke
  and Session-expiry copy; each domain supplies only the confirm destination callback. Post and Page are current
  consumers; Work and the remaining collaborative editors are pending. The target contract makes exact Collab signals
  stop input and disconnect before presentation. Session expiry confirms through login with the current editor
  URL as the return target; it is not presented as a resource permission revoke. App and Feature presentation uses raw icons
  without decorative background wrappers; interactive `IconButton` state remains separate.
- Core `IconButton` with `low` emphasis is background-free in idle, hover, focus, active and disabled
  states. Tone, opacity and the focus ring carry state; a filled or selected surface requires an
  explicit stronger emphasis.
- Feature Media `MissingMediaView` composes the Core `Alert` and shared media shell. Post public,
  share and managed reads use the same block renderer: an absent delivery preserves the restored
  block, derives its file/image/video/audio fallback from block type and exposes no media or download action.
- Document layout is owned by `features/document-layout`: its `ui` subtree uses a local view model,
  while collaboration-contract exports and mapping stay at the feature boundary.
- Version history is owned by `features/version-history`: its `ui` subtree is a prop-driven view,
  while requests, translations, notifications, locale formatting, and service-model mapping stay
  in the controller. Post, Page, and Work expose source list and restore only; there is no manual snapshot
  button or Web snapshot route. Target locale rooms expose the existing target document and collaboration state,
  but target revision is an internal CAS value with no target Version, history, or restore UI. Collaboration
  creates a checkpoint after 30 minutes in a long edit session and a final version after the last contributor
  disconnects. Each source version lists every contributor by its required preserved nickname; a Member UUID is
  never a display fallback. Empty contributor data is labeled as a system or earlier version, and each row
  displays its snapshot source locale. The common restore confirmation identifies the source document being
  restored. Source restore leaves every existing target document unchanged, readable, and editable, starts no
  generation, and leaves any queued or running generation bound to its saved request artifact. After success,
  the controller invalidates entity translation entries and jobs and refreshes server
  metadata; each editor reloads its canonical source room and asks the locale-scoped OG controller for the
  authoritative latest generation. Restore errors remain bounded and leave both surfaces open.
- Anonymous desktop and mobile Shell login actions use the icon-free Core `TextButton`; authenticated
  avatar and account-menu behavior remains owned by `features/shell`.
- Unified login is owned by `features/auth`: the empty-email continue action remains visibly primary while
  native required validation and the controller guard prevent an empty request. One shared active-action state
  gives only the selected email, passkey, or social action a spinner and disables every alternative. Explicit
  passkey login aborts a still-pending ceremony after its external browser window closes and focus returns,
  leaving every login action retryable.
- Admin Site Settings is owned by `features/site/SiteSettingsForm`: the Feature composes canonical
  Core fields and sections, while the route owns queries, mutations, asset controllers, and maintenance.
  Its form and SetMany patch types exclude the read-only runtime `site_origin`, derived asset URLs,
  relation projections, OG result state, and removed cache settings.
- Scheduled legal ShareLink content is rendered by the prop-driven
  `features/policy/LegalShareDocumentView`. `/s/{token}` owns token, expiry and optional password proof;
  the Feature composes the shared Alert and Table of Contents without owning access authority.
- `features/metadata/OgImagePreview` presents current, queued/processing, failed, cancelled, and
  superseded generation state. Failed state exposes an explicit retry/regenerate action and only a
  bounded application reason. `useOgImage` treats lifecycle delivery as a low-latency wake-up,
  refetches the authoritative latest generation, clears an older image while a replacement is
  pending, and refreshes the route after the exact ready asset arrives.
- File Manager is owned by `features/file-manager`. The full manager is mounted only at the static
  Site Admin menu route `/admin/files`; Author has no standalone manager route and reaches shared Files
  only through the editor library picker. Its controller owns FileService queries, upload,
  folder/file mutations, move destination navigation and deletion confirmation. `FileManagerView`
  and editor library selection reuse the prop-driven `FileBrowserGridView` and `FileBrowserViewToggle`;
  List rows, checkbox selection and sortable headers use Core `DataTableView`. The Feature injects
  one-click selection, double-click/Enter open, right-click,
  Cmd/Ctrl toggle, Shift range and drag-box behavior through opt-in row interaction. Feature-owned
  `FileBrowserHeader`, `FileBrowserTooltip`, and `FileBrowserStatusBar` compose Core controls; they do not
  move into Core because directory path, permission slots, view state and selection policy are File behavior.
  Search, filter, sort and icon actions share one borderless header; selected count replaces footer status.
  Core Modal/Input/Button/DropdownMenu controls provide rename, impact and preview surfaces.
  The editor reuse flow follows the same boundary: `EditorFileLibraryPicker` owns debounced browse/search
  requests, pagination, folder-path navigation and block eligibility, while the prop-driven
  `EditorFileLibraryPickerView` composes the File Browser grid/toggle with Core Input/Button/TextButton/
  DataTableView controls. Incompatible site-wide File results stay visible with dimmed, non-selectable
  semantics while remaining available for preview and download; the Pure View does
  not infer MIME, size, processing, RPC, or editor-block policy. Its interactive rows opt out of browser text
  selection so double-click open/confirm does not leave an accidental selection highlight. Unified upload and
  library sources are top-level tabs inside the Core ContentModal `workspace` size: desktop keeps a 24px viewport
  inset and mobile becomes full-screen. Library defaults to the shared visual grid, retains an optional List view,
  scrolls results independently, automatically requests the next search page near the end, and fixes selection
  status plus Add in the footer. The shared File Browser sort/filter controls sit immediately before search. While a
  query is present, a compact Finder-style scope bar below the main toolbar switches between all Files and the named
  current folder subtree; it stays hidden outside search. Search ends at the same content edge as the List table.
  File selection never narrows the result surface with a persistent inspector. Single click selects, double click
  confirms an eligible File, and the context-menu Preview opens the shared media preview with metadata in a centered
  Quick Look modal. Folder double click and Enter continue to navigate.
  The picker context menu is selection-scoped: Folder exposes Open, eligible
  Files expose Preview/Download/Add, and ineligible Files omit Add. Rename, move, and delete stay in File Manager.
  `EditorFileInsertView` owns the prop-driven upload/library choice, presents both equal sources with the same
  neutral Core Button treatment, and keeps instructions to one direct line,
  while its panel controller owns the accepted MIME set and delegates native picker/reset behavior to Mantine
  FileButton instead of maintaining a feature-local hidden input. `FileBlockView` owns
  empty/loading/MIME-branch presentation; its empty surface uses the same square Core upload surface and
  semantic theme colors as the rest of the site. The editor controller resolves canonical File status and
  supplies the existing image/audio/video/file views.
  Folder `Open` navigates; missing-folder and empty-folder states remain distinct. File `Preview` uses a centered Quick Look modal, renders image/PDF directly and reuses the same AudioPlayer or
  VideoPlayer used by Post/Page. Audio is HLS-first with waveform only (no spectrogram); video is
  HLS-first with poster. Unsupported files fall back to metadata plus download. Active usages block
  deletion; the bounded first 5 are never treated as the full set. `FileMediaPreview` is only the
  File delivery-to-player adapter; playback controls and media runtime remain in the shared players.
  Production과 Storybook은 같은 locale label 구성을 사용하며 action failure는 번역 가능한 안정된 분류만 UI에 전달한다.
- Feature Media의 AudioPlayer와 VideoPlayer는 공통 media tokens와 status overlay를 소유한다.
  Audio는 64px waveform과 compact background-free controls를 사용하고, Video.js는 HLS·caption·fullscreen
  runtime으로만 남는다. 기본 Video.js skin 대신 square surface, neutral overlay와 site primary accent를
  적용하며 light/dark·narrow Story에서 같은 상태를 검증한다. Audio·Video·Release Track의 허용된
  원본 다운로드는 공통 tooltip icon이며 player가 있으면 제목 header가 아니라 player control에 둔다.
  Attachment는 같은 icon을 제목·metadata와 함께 1px square border의 단일 file surface 우측에 둔다.
  Durable editor schema는 MIME과 무관한 `file` block 하나이며 Tiptap NodeView가 verified MIME으로
  image·audio·video·일반 file view를 선택한다. 별도 `attachment` block은 없다. 일반 file의 Tiptap
  NodeView와 public view는 같은 파일명·type label·size·caption typography를 사용하며, caption은
  metadata 바로 아래의 동일한 file surface 안에 둔다. Image는 같은 full-width media sizing을,
  Audio·Video는 같은 title·size·player·caption 합성 view를 authoring과 public에서 재사용한다.
- Authenticated UI state uses the lean Member session projection. The root request calls
  `MemberService.GetCurrentSession` once, hydrates `SessionProvider`, and does not issue a duplicate
  mount request. Biography, website, social links and My-section capabilities are loaded only by
  their detail routes. Focus/visibility/interval revalidation remains bounded to `/api/auth/session`.
  Profile and avatar mutations return `MemberSummary` and update only nickname/avatar in that cache;
  Account email, role, status, ban, provider, passkey, and session data is never synthesized into it.
- My profile, settings, and security preserve the ownership split: Member owns nickname/profile/avatar,
  locale, cookie preferences, email candidate/primary projection and My sections; Account owns email
  proof, Identity-scoped newsletter mutation, providers, passkeys, sessions, role/status/ban, and deletion. My settings uses one `GetMySettings`, while My
  security uses one `GetMySecurity` aggregate instead of per-section calls. UI copy names the selected
  canonical email with the locale-native Primary email term (`대표 이메일` in Korean); `canonical`
  and `primary_email` remain internal contract names. OIDC providers are labeled as connected social
  logins (`연결된 소셜 로그인` in Korean). There is no separate Connected emails section: one canonical
  row shows whether Email Code is available, and Change replaces that canonical identifier after proof.
  Provider-backed delivery candidates never expose connect/remove Email Code controls or become a second
  login identifier; provider removal remains in Connected social logins.
  Before `/my/security` renders this aggregate, its server boundary checks the current active Session's
  three-hour privileged freshness and starts a refresh login when needed. Account and Kratos mutations
  independently enforce the same boundary. The login view explains that the Session has not expired:
  the user signs in again for security and the original request continues automatically. Email, Primary
  email, passkey, Session revoke, other-session revoke, and deletion-request controllers retain only the
  exact same-tab action in a one-use, ten-minute continuation bound to the originating Member; the URL carries
  only a bounded resume flag. A different Member Session consumes and discards that continuation without mutation.
  On return the controller removes that flag before resubmitting and the owning authority revalidates the
  target and removal guards. Social linking and unlinking continue through the Kratos privileged settings
  flow and its existing bounded provider continuation. Personal access tokens on `/my/settings` are generic Geul API
  credentials available to every Member without capability checkboxes. AccountService remains the sole credential
  lifecycle authority. A returned secret appears in a one-time copy surface after the same privileged freshness proof.
  Author/Admin additionally see the canonical Remote MCP endpoint with OAuth 2.1 browser login-and-consent guidance
  and the public AI-readable `/guides/remote-mcp.md` setup document on `/my/settings`; ordinary Users see no MCP label,
  control, or guidance. The same settings surface lists Hydra-owned MCP consent sessions separately from Kratos
  browser Sessions and can revoke the exact current-Member consent-request token chain after a fresh role and subject
  recheck. Remote MCP rejects Geul PATs, and Web does not register OAuth clients or handle access tokens itself.
  The Admin Member detail route reuses the same single-token lifecycle and
  one-time secret surface for its target Member; it does not add token names, capability selectors, or MCP credentials.
  Security Storybook stories render only these pure Views with pre-resolved visual-state props; they do not
  reproduce linking, removal, reauthentication, or API continuation logic in a story harness. Thin story
  adapters resolve the same production translation keys while the shared Storybook decorator owns locale,
  direction, font profile, and light/dark theme.
- Nickname validation is split by responsibility: Core `ValidatingTextInput` renders only visual state;
  Feature `useNicknameValidation` owns trim, case-sensitive 1-100 validation, debounce, availability,
  and stale-response cancellation. Onboarding and My profile own submit/race handling. Routes own only
  session gates and navigation.
- `onboarded` is independent from nickname. An onboarding-only principal is routed to
  `/onboarding/nickname` before unrelated root bootstrap; the onboarding route still loads its shell.
  Email starts blank, while Google and GitHub suggestions prefill an editable form that is always shown.
  The single completion form is a borderless layout rather than a card. Core `PageHeader` owns its shared
  route-heading and description scale, and logout remains a centered quiet text action so a forced incomplete
  Session always has an escape without competing with completion.
- `Feature/Admin/Member List` and `Feature/Admin/Member Profile` compose the production profile form
  and `ServerDataTable`; they do not keep a separate mock table or account-creation action. Long
  Member values truncate inside the shared table, and overflow stays contained. An unonboarded
  `role=user` remains fully editable by Admin while its onboarding badge stays visible.
- Post authority uses server-provided `allowed_actions`; Web does not rebuild it from site role.
  `PostParticipantsDialog` reuses Core `SearchComboboxView`; Role sizes to the widest translated label
  while Member search takes the remaining row and both controls stack at narrow widths. Row identity
  truncation stays separate from fixed role/actions. It shows each Member once
  as exactly Author or Collaborator; departed participants use a compact status icon, cannot change roles,
  and remain removable according to the actor's permission. Disabled action names stay stable while
  tooltips explain the reason. Collaborator to
  Author uses `ADD_AUTHOR`; Author to Collaborator requires both `REMOVE_AUTHOR` and
  `MANAGE_COLLABORATORS`, and the last Author remains. Scheduling keeps the chosen IANA zone beside
  the UTC instant. Core `DateTimeInput` composes separate Mantine `DatePickerInput` and dropdown-free,
  24-hour `TimePicker`
  fields and owns locale data, calendar labels, compact popover positioning and narrow-screen date
  modal behavior; Post owns the
  wall-clock value, zone, validation and submit. Storybook loads the same official Mantine Dates CSS
  as the app and adds no Feature calendar skin. A live Collab revoke locks input and disconnects; confirmation re-reads Post and
  opens the published Post or home through the shared blocking Editor dialog. A live Session expiry uses the
  separate shared Editor Session dialog and returns through login to the exact Post editor URL.
- Public Post rendering consumes its own media delivery and download-access maps. Expired image,
  HLS, waveform, poster, and original-download refs re-read the owning Post in the same Session or
  current-view ShareLink password context; Post UI never refreshes them through the public File
  boundary and does not persist the password. Page and Work retain their existing File refresh path.
- Series authorization assignment remains named Manager. Post has no Manager compatibility surface.
- Newsletter membership is an Identity-owned application fact, not a Member preference or separate subscriber Feature. The public Shell
  footer owns the `/login?intent=newsletter` CTA; the GET itself never mutates membership, and the
  exact same-origin login `return_to` preserves that purpose across the auth callback. A stale ordinary
  redirect cannot enable it. The verified intent displays pre-proof copy explaining that subscription
  confirmation follows login, and the signed-in user must explicitly submit the post-proof subscription CTA. Self-service uses
  `features/my/SettingsForm`, token-only opt-out uses
  `features/newsletter/UnsubscribeContent`, and admin unsubscribe-only control stays in
  `features/admin/user`. Campaign recipient eligibility is owned separately by
  `features/campaign/CampaignRecipientScopeControl`; Audience remains Member-only.

There are no remaining catch-all feature ownership exceptions.

## Duplicate families

- The 18 admin `*ModalContext.tsx` and matching `*Modals.tsx` pairs are valid domain controllers,
  but their visual surfaces must continue to converge on Core Modal.
- `DraftModeAlert` composes Core Alert. Translation source/target selection uses the normal
  `TranslationLocaleControl`, and target existence has no lifecycle/status surface.
- `ImageDropzone` belongs to `features/site/SiteAssetUploader` as a controller over its pure
  `ui/ImageDropzoneView` and Core ImageUpload. Featured-image upload is now Core
  `ImageUploadCropField` plus the `features/upload/ImageUploadCropController`; persistence
  controllers remain in each consuming feature.
- Upload progress state belongs to the Feature upload controller and
  `lib/hooks/uploadSurfaceActivity`; presentation stays in `MediaProcessingSurface` with Core
  Progress. One activity is monotonic, resume rehydrates from server completed parts, and only a
  new activity resets the surface. Production Storybook coverage also verifies sanitized terminal
  upload/processing failure, expired pending-media removal through runtime projection, and one
  representative immersive-scene GLB upload-to-clear lifecycle; exhaustive asset-format and
  cancellation matrices remain focused component tests.
- The 21 admin `Create*Button` components split into 10 identical modal-open wrappers and 11
  action-backed controllers. The visual trigger should be shared while action ownership remains in
  each feature.

## Translation authoring state

- `useActiveEditLocale` distinguishes the authoritative source room from locale-scoped target rooms. Source
  and target rooms are editable only under the owning-domain permission. Target selections resolve the shared
  source graph plus locale-owned overlay, attach the same Collaboration presence provider, and expose save only
  when permitted. Target commands never mutate shared structure, File relation, or source-owned fields; target
  revision is an internal CAS value, not a Version/history/restore UI.
- Source metadata and rich-text preserve the existing immediate/debounced source persistence paths. Accepted
  source input changes leave every existing target document unchanged, readable, and editable, and never create an
  AI request. Target Member/MCP edits use their own CAS and are immediately readable/editable after commit. Queued or
  running generation keeps using its saved request artifact when the source changes. Archived Post,
  Work, and Program Event authors see source/target rooms, presence, cursor, and conversation read-only; Admin can edit.
- A locale either has a target document or it does not; target existence has no lifecycle/status model.
  `EntityTranslationsPanel` renders the document when it exists, exposes explicit Create
  when it does not, and expose explicit Regenerate for an existing target. They expose no target lifecycle/status
  surface. Create/Regenerate requires one locale or an explicitly selected locale set, and an
  empty selection never means all. Job UI shows only persisted `queued|running` work and exposes cancel while the
  job remains active. Terminal `translation.lifecycle` signals only wake authoritative active-job and target refetch;
  they create no terminal row or status surface. A later explicit Regenerate is a new job from the then-current source.
  A completed Regenerate replaces the whole target even if a Member/MCP edit committed after the request, and applies
  the saved request artifact against the current stable-unit graph. Target CAS remains internal and no prior target
  restore is offered. Email Template uses the same target-editor boundary. Email Layout target rooms expose only
  stable visible-text and `alt`/`title`/`aria-label` units through `EmailLayoutTargetEditor`; missing unit values show
  source fallback, explicit empty remains empty, and target clients never receive an editable HTML, CSS, URL, or
  placeholder surface. Post Series title and description use their locale-scoped Collaboration room with source
  fallback for missing target values and explicit-empty preservation; slug and other shared controls stay source-only.
  Menu uses the same exact-locale Collaboration room as its source editor. Source locale owns name and shared item
  structure; target locales expose only applicable labels, preserve explicit empty values, and use current source
  labels only for missing translated values. Fixed-locale labels are editable only in their designated locale.
- Source/original view is a normal `TranslationLocaleControl` selection with no translation warning. Source changes
  start no background generation, preserve every existing target document, and use source fallback only when the
  requested target document is absent.
- Translation Settings owns one exact case-sensitive protected-term list. Admin Tags input trims terms, removes only
  exact duplicates, preserves fixed spelling, and shows `Photoshop` and `React Native` as examples; it does not
  auto-learn terms or surface provider suggestions.
- If the owning root is public, including a Post with PUBLISHED or ARCHIVED status, public read serves the requested
  target document whenever it exists; only an absent target document falls back to source. The locale control does
  not label a target as automatic, AI-authored, or manually authored. Legal translated documents use
  `LegalTranslationNotice` with exact text `참고 번역이며 원문이 우선합니다`; it is non-dismissible and remains
  visible in print.

## Rich-text engine cutover

- `EDITOR_INVENTORY.md` at the workspace root owns the user-observable editor contract. Web component
  boundaries implement that contract; they do not retain a second BlockNote-specific product model.
- Every Storybook module that renders rich-text authoring uses the production Tiptap runtime. Static CI
  rejects direct `@blocknote/*` story imports, and the Storybook runner rejects a rendered legacy editor
  root. Unsupported Tiptap nodes or commands are visible migration failures rather than skipped stories or
  generic mock surfaces.
- `Feature/Editor/Source Editor` catalogs the standalone Monaco component and is not a rich-text runtime.
  Node-specific `Feature/Editor/Tiptap/File` and `Feature/Editor/Tiptap/Math` stories render their fixtures
  through `TiptapEditor`, so their Tiptap classification represents the production editor boundary.
- Tiptap authoring composes shared Core controls and Feature file/media controllers. Selection-specific
  bubble menus replace the fixed formatting toolbar. The Notion-style block handle uses one control:
  dragging moves the block, while clicking opens its contextual actions without changing the document.
  Block move, alignment and shared media resize retain equivalent keyboard command paths.
- Terms and Privacy authoring use that same `TiptapEditor` runtime, Slash menu, block handle and
  selection bubble menu. Their Policy profile narrows the shared command catalog to paragraph,
  heading, list, quote, code, divider, table and Emoji; it does not keep a fixed policy toolbar or a
  second editor lifecycle.
- Text split/insert mutations preserve the exact sibling position and do not emit synthetic moves for unaffected
  following Blocks. Backspace at a direct text Block start (Paragraph, Heading, Quote, or list item) joins a
  preceding direct text Block while preserving its type, ID and nested children; an empty text Block is removed and
  leaves the caret at the preceding text Block end. At a text-to-atomic boundary, repeated Backspace selects then
  removes the preceding Block instead of consuming input without a state change. Enter on an exactly selected File, external video, Map, Math, Code or
  executable Block inserts a new Paragraph immediately after it and moves the text caret there without changing
  the selected Block. Every visible blank line remains a distinct empty Paragraph with its own durable ID and
  sibling order; consecutive blanks are never collapsed or represented as nested Paragraphs. Unrelated text
  transactions retain those blank Paragraphs, mounted File players and
  external-video iframe DOM. Opening or cancelling link edit also keeps the iframe mounted; only a changed resolved
  provider URL may reload it, while layout, selection and editor-editability update their own presentation.
- Collaborative text keeps its nested identity inside plain styled leaves, link labels, inline math sources and
  Table cells. Concurrent edits update those text leaves instead of rebuilding the containing locale content;
  inline topology or style changes replace only the smallest changed child window, so the surrounding inline
  sequence is not duplicated.
- Shift+Arrow text ranges keep their native anchor and head across Blocks. Every empty Paragraph crossed by the
  range paints a short one-line selection marker because it has no glyph for the browser to highlight; a collapsed
  caret, NodeSelection and CellSelection do not paint that marker or change document content.
- Inline math source is ordinary plain-text content inside the paragraph, not a standalone Tab stop or
  NodeSelection. When cursor or Shift selection enters it, source characters participate in the same text
  selection and undo history as their surrounding paragraph; outside that selection, valid source renders
  through KaTeX while invalid source stays directly editable. It owns no textarea or bubble editor. KaTeX
  keeps MathML and HTML output for accessibility while the root vendor stylesheet hides the visual duplicate
  in both the application and Storybook.
- Generated public rich-text rendering is covered by focused renderer tests. The public Post/Page boundary
  uses `GeneratedRichTextBlockView`; only an exact top-level standalone YouTube/Vimeo paragraph is promoted,
  while list children and every shared consumer remain ordinary links. An `editable=false` editor or a
  story-only renderer cannot substitute for the public side. The `Inline Math` case places paragraph text
  around `E^MC2` and compares character-addressable authoring with the public KaTeX projection.
- Tiptap authoring remains one continuous collaborative document. Its Geul-owned page-preview extension
  presents A3, A4, A5, Letter, Legal, or Tabloid portrait/landscape pages with the current public
  Post/Page/Work header, repeated document header, and current/total footer, but keeps all pagination state
  outside the document and undo history. The extension follows the MIT-licensed
  `RomikMakavana/tiptap-pagination-plus` page-size and decoration model only as a design reference; it has no
  package dependency, injected global stylesheet, or `display: contents` table override. Storybook retains
  portrait, landscape, long/missing-image, and multi-page authoring fixtures for this production boundary.
- Browser printing and the actual public Feature view remain the final page-break authority. Public print
  regression coverage therefore renders that public boundary independently of the authoring approximation.
- Public print presentation stays with each rendered Feature. `CodeBlockSurface` replaces fixed-height Monaco with
  complete wrapping Shiki-highlighted source. Executable p5.js/Three.js/Shader blocks replace their live sandbox or
  worker canvas with the same static code presentation; Shader prints each non-empty stage under its filename.
  Code lines may break across pages while each line stays intact. Tables use semantic `thead`/`tbody`, repeat the
  header at page boundaries, and break between rows. `PostHeader` preserves its Featured Image overlay as one bounded
  print fragment. `WorkPublicHeaderLayout` uses the same bounded Featured Image overlay for Work. Post, Page, Work,
  executable and legal-document bodies switch screen flex/grid wrappers to ordinary block flow for paged
  fragmentation through their owning CSS Modules. `PrintButton` supplies the same native print action to Page, Work
  and Policy public views. `lib/styles/print.css` retains only document-wide page policy: `size: auto` leaves A5, A4,
  A3 and Letter selection to the browser print dialog with a shared 12mm margin, while Feature presentation remains
  in its CSS Module or materialized document stylesheet. `Feature/Post/Print Preview`, `Feature/Page/Print Preview`,
  `Feature/Work/Print Preview` and `Feature/Policy/LegalShareDocumentView` stay in screen mode with a real print action
  and pagination-stress code/table fixtures. The browser print engine, not the authoring page-preview
  approximation, remains the final page-break authority.
- `LegalDocumentMetadata` renders Policy Version as plain text plus the authoritative effective start and optional
  end date in the same public DOM used by screen and print. Policy `created_at` remains an authoring timestamp and is
  not relabeled as publication; public activation and publication use the effective start transition.
- Legacy durable node names remain readable until existing documents are compatible; this does not permit
  retaining BlockNote packages, views, dictionaries, adapters or server renderers after the hard cutover.

## Type leaks

Three files still import interactive Mantine types directly:

- `features/shell/LanguageMenu.tsx` uses `ActionIconProps`.
- `features/translation/TranslationLocaleControl.tsx` uses `NativeSelectProps`.
- `lib/countries.ts` uses `ComboboxItem` and `OptionsFilter`.

These must move to Core-owned public prop and option types as their corresponding primitives are
canonicalized.
