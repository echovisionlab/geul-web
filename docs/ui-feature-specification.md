# UI feature specification and categories

This document organizes Geul's current UI responsibilities and records source-checked workflows. The
[generated inventory](./design-system/generated-inventory.md) is the current source of counts, entrypoints,
owners and preview links. The [component index](./design-system/component-inventory.md) and
[machine-readable inventory](./design-system/ui-inventory.json) enumerate all Core/Feature TSX value-export
candidates, consumers, local props, importing stories and importing tests.

The [route-to-preview matrix](./design-system/route-preview-coverage.md) links the reviewed profile,
security, newsletter, Series, verification and share-password adapters to their precise view/section
scope. Every other route keeps its missing composition coverage explicit.

A source file, a story variant, an importing test and a verified user flow are different evidence.
This specification does not claim that a story proves backend authorization, that an importing test
asserts every state, or that a `View` filename establishes a pure view. In particular,
`features/form/PublicFormView` and `features/file-manager/FileManagerView` have controller/runtime
responsibilities despite their names. Their ownership must be read from their implementations.

## Product taxonomy

The taxonomy is maintained in [feature-categories.mjs](../scripts/design-system/feature-categories.mjs).
The inventory generator requires every existing Feature domain to have exactly one category. New
capabilities stay with the feature that owns their meaning; reuse alone does not make them Core.

| Category                                            | Domains                                                                                                                                                              | User-facing responsibility                                                                                                        |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Identity, membership and personal settings          | `account`, `account-email`, `auth`, `member`, `my`, `user`                                                                                                           | Login and recovery, nickname onboarding, profile, account email, sessions, passkeys, API/MCP access and personal preferences      |
| Content, authoring and version history              | `artist`, `authoring`, `client`, `document-layout`, `draft-mode`, `editor`, `label`, `page`, `post`, `program-event`, `release`, `series`, `version-history`, `work` | Public content presentation, domain editors and associations, shared authoring chrome, source/locale ownership and source history |
| Forms and submissions                               | `form`                                                                                                                                                               | Public form access and submission, builder/settings/translations/submission management and dashboard                              |
| Files, media and executable content                 | `executable`, `file-manager`, `media`, `media-download`, `mermaid`, `upload`                                                                                         | Asset browsing/upload/crop, media presentation, download policy, diagram and executable block surfaces                            |
| Maps, places and location input                     | `location`, `map`, `place`                                                                                                                                           | Geographic inputs, place selection/editing, map authoring and public rendering                                                    |
| Campaigns, communication and sharing                | `analytics`, `campaign`, `email`, `newsletter`, `share`, `social-links`                                                                                              | Campaign composition/delivery/analytics, email templates, subscriptions, share access and social links                            |
| Legal policy, consent and localization              | `cookie-consent`, `policy`, `translation`                                                                                                                            | Consent choices, current/history legal documents, requested content language and explicit target generation                       |
| Site administration, navigation and common adapters | `admin`, `application-error`, `data-table`, `date-time`, `menu`, `metadata`, `navigation`, `print`, `search`, `shell`, `site`                                        | Admin and public shell, branding/assets, menus/search, metadata, errors and controller adapters around Core                       |

Each domain's complete source-file list, owned component candidates, stories, importing tests and
direct route imports is under `domains` in the JSON. The taxonomy covers the whole source tree;
the detailed workflow records below cover inspected behaviors. Other source-indexed domains retain
their existing specifications in [generated route inventory](design-system/generated-inventory.md) and
[component inventory](design-system/component-inventory.md).

## Route families and authority

The inventory counts page **source entrypoints**, including redirect-only routes and development-only
pages. A count is not a promise that all paths render a standalone production page. Route groups are
removed from URL paths; dynamic segment names remain explicit. Query-based editor/tab modes are
recorded here because they are not separate `page.tsx` files.

| Family      | Entry and action                                                                                    | Authority owner                                                                        | State / routing contract                                                                                                                                             |
| ----------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public      | `/`, root Page catch-all, content detail/collection paths, category/tag/user, sitemap and changelog | Each route's public query and domain Feature                                           | Locale/content fallback and visibility stay with the route; missing content is not converted into a successful empty editor                                          |
| Identity    | `/login`, `/verify`, `/onboarding/nickname`, `/account/*`, OAuth consent                            | Auth/account/member controllers and server actions                                     | Login, verification, continuation and recovery policies are feature-specific; read the exact controller before extending a flow                                      |
| My          | `/my/*`                                                                                             | [My layout](<../app/(general)/my/layout.tsx>) and `getMySections`                      | Missing session redirects through login with return path; unavailable sections redirect to an allowed section or `/`                                                 |
| Admin       | `/admin/*`                                                                                          | [Admin layout](../app/admin/layout.tsx)                                                | Missing session redirects through login with return path; a signed-in non-admin redirects to `/`; nested page operations still require their server-side permissions |
| Forms       | `/forms/[slug]`, password, success, dashboard                                                       | [Form route](../app/forms/[slug]/page.tsx), public access actions and form controllers | Public access reason drives access UI. `?edit=true` requires a signed-in Admin, redirects legacy slug to immutable form ID and selects a known tab                   |
| Share       | `/s/[token]`                                                                                        | [Share route](../app/s/[token]/page.tsx) and public ShareLink client                   | Validate token/type/entity before rendering. Invalid or missing responses become not-found; password-required flow remains distinct from valid access                |
| Development | `/editor-lab-local`                                                                                 | [Local lab route](../app/editor-lab-local/page.tsx)                                    | Explicitly returns not-found outside `NODE_ENV=development`; excluded from product page completeness claims                                                          |

The source index records `inheritedLayouts`, imported controller/view modules and selected call names
for each route. These are navigation aids; permission behavior is established by the source-checked
records, not by matching `get`, `check` or `isAdmin` in a name.

## Source-checked workflow records

### Personal newsletter preferences

- **Entry / owner:** `/my/settings` → [SettingsForm](../features/my/SettingsForm.tsx) →
  [SettingsFormView](../features/my/ui/SettingsForm/SettingsFormView.tsx).
- **Input / action:** Initial subscription boolean; a labeled subscribe/unsubscribe Button requests
  the opposite value through `onSubscriptionChange`.
- **Result:** The controller changes its displayed subscription only after a successful action result.
  It clears an old error on a new attempt and shows a success notification after the confirmed result.
- **States:** Subscribed/unsubscribed status, mutation pending/loading, optional disabled state and
  inline failure. Both a failed result and a thrown request are projected to an error. The view uses
  a polite status region plus an alert for failure.
- **Authority:** My section/session guards apply; persistence belongs to
  `setCurrentUserNewsletterSubscriptionAction`. The UI Kit's local state adapters must not call it.
- **Evidence:** [Controller test](../features/my/SettingsForm.test.tsx),
  [view stories](../features/my/ui/SettingsForm/SettingsFormView.stories.tsx). These links identify
  existing artifacts; they do not replace running the relevant test.

### Personal settings and security access

- **Entry / owner:** [Settings route](<../app/(general)/my/settings/page.tsx>),
  [security route](<../app/(general)/my/security/page.tsx>) and My feature controllers.
- **Composition:** The settings page reads canonical email, preferred locale, newsletter subscription,
  analytics consent, personal API token summaries and role. Remote MCP information and grant controls
  are shown only when `canAccessMcpIntegrationSettings` allows the role.
- **Authority:** [MCP access projection](../features/my/mcp-integration-access.ts) permits `author` and
  `admin`. Do not apply that condition to every personal-settings control: token projection and MCP
  visibility are separate code paths.
- **Security flow:** A missing Member redirects to login. Failed security read renders an error.
  An insufficiently fresh security session redirects through refreshed login while preserving supported
  continuation parameters. A successful read supplies sessions, providers, canonical email, email-code
  availability and passkey count to `SecurityForm`.
- **States to verify:** Load failure, empty/populated sessions and grants, current/other session,
  stale/fresh reauthentication, pending/failure for each action and once-visible token secret.
  Detailed action restrictions belong to their controllers/server boundaries; a page preview should
  expose sample states without attempting actual revocation or secret issuance.

### Post public view and canonical editing

- **Entry / owner:** [Post route](<../app/(general)/posts/[idOrSlug]/page.tsx>),
  [edit controller](<../app/(general)/posts/[idOrSlug]/PostEditRoute.tsx>) and
  [PostEditor](../features/post/PostEditor/PostEditor.tsx).
- **Public action / result:** Resolve requested content locale. A supplied ShareLink token uses the
  token-specific read; ordinary visits use the public visibility query. Missing data delegates to the
  shared Page-route fallback before the document composition renders. Share metadata is no-index.
- **Editing action / result:** `?edit=true` enters the server edit controller. An anonymous visitor
  goes to login with the editor return URL. The manage read determines available actions; absent or
  unauthorized data returns not-found. A valid slug editor URL redirects to the immutable Post ID.
- **Authority exception:** An archived Post may be read through this editor entry when the current
  role is `author`; this is not a grant of edit authority. Otherwise `PostAction.EDIT` is required.
  ShareLink management data is loaded only with `MANAGE_SHARE_LINKS`.
- **Editor states:** The editor combines allowed actions, locale-room authority and the permission
  revocation boundary. Title/content changes, restore authority and AI target availability must follow
  their exact owning checks. Authoring header connectivity/sync indicators remain a different state
  from persistence failure or revoked permissions.
- **Verification boundary:** Public rendering, route fallback, share access, revision/collaboration
  and source/target mutation are controller/integration concerns. A reusable visual page composition
  is catalog coverage for presentation and local controls only.

### Form access, submission and administration

- **Entry / owner:** [Form route](../app/forms/[slug]/page.tsx),
  [PublicFormView](../features/form/PublicFormView.tsx), Form builder/settings/submission features.
- **Public input:** Requested locale, access result, schema/form data, optional share token/password and
  request country. Phone defaults are resolved from the request country and content locale.
- **Access sequence:** A password-required result checks the per-form saved password, verifies it,
  removes invalid saved values and requests protected form data only after verification. Missing form
  data renders the reason-specific access boundary. Password/protected-read failure offers retry;
  pending access renders the page loader. An invalid schema maps to the server-error access boundary.
- **Submit result:** `submitFormAction` receives form ID, values, password and requested locale.
  An action-level error shows a notification; success enters redirecting state and navigates to the
  localized success URL. Do not describe every thrown submit error as a handled state without checking
  the owning mutation and form renderer.
- **Admin edit sequence:** Require session and Admin role, resolve form, redirect slug to UUID, load
  initial fields, and select `builder`, `settings`, `translations` or `submissions` (`builder` fallback).
  A requested submission must belong to this form or the route returns not-found.
- **States to catalog:** Accessible/restricted/password-required, checking/retry, invalid schema,
  required-field validation, pending/redirecting, empty/populated submissions and destructive
  confirmation. A local page kit may demonstrate these with prop data; it must not replace the real
  schema renderer, permission boundary or submission controller.

### File browsing and mutations

- **Entry / owner:** [Admin file route](../app/admin/files/page.tsx) →
  [FileManager](../features/file-manager/FileManager.tsx) →
  [FileManagerView](../features/file-manager/FileManagerView.tsx).
- **Input / actions:** Folder path, query, MIME filter, sort, grid/list mode and selected IDs. The
  controller owns folder listing versus search, incremental results, file/detail usage reads, upload,
  rename, move and deletion commands.
- **Result / states:** The view accepts loading/searching/loading-more, file-detail loading, upload
  percentage, mutation loading, error and folder-not-found states. Opening a file fetches detail and
  usage. Source-backed selection lives in `useFileManagerSelection`; Core DataTable remains the
  table surface rather than a second file-table implementation.
- **Authority:** The production page passes `viewerRole="admin"` under the Admin layout. The view's
  broader role prop is not evidence of an independently served Author file-manager route. Editor
  library picker authority remains with its consuming domain.
- **Catalog limitation:** This module imports media/runtime and selection behavior as well as domain
  contract types. It does not satisfy the pure `features/**/ui` boundary merely by being named `View`.
  Its prop-driven subviews are separately indexed; page-level runtime preview requires an explicit
  documented adapter and appropriate fixtures.

### ShareLink validation and destination selection

- **Entry / owner:** [Share route](../app/s/[token]/page.tsx), Feature Share password/link views and
  each destination's public controller.
- **Action / result:** Validate the token; require entity type and ID plus validity or password-required
  result. Page links resolve access and may render a restricted boundary. Post, legal and Form links
  have dedicated client compositions. Other supported types redirect to the canonical public
  destination with the token; unsupported types return not-found.
- **Legal exception:** A missing token preview legal document may redirect to a publicly available
  history version. This is decided by `isPublicLegalHistoryVersion`, not by the visual password form.
- **States:** Valid, password-required, invalid/expired/missing, access-restricted and authorized
  destination. UI preview data must never make a token-specific query reuse an ordinary public
  snapshot or imply that changing a control can bypass token validation.

### Source version history and restore

- **Entry / owner:** [VersionHistoryDrawer](../features/version-history/VersionHistoryDrawer.tsx) →
  [VersionHistoryDrawerView](../features/version-history/ui/VersionHistoryDrawerView.tsx).
- **Read:** Opening the drawer lists source versions. Contributor labels preserve recorded nicknames
  in order; empty contributor names use a system/legacy fallback. Date formatting uses the shared
  locale/time-zone adapter.
- **Restore authority / action:** The control is available only when `canRestore` and a resolved
  current source locale are both truthy. Select an existing row, confirm, then call the restore request.
- **Success:** Await the domain's `onRestored`, invalidate translation entries and jobs, refresh the
  route, notify success, close confirmation and drawer.
- **Failure:** Keep the drawer/confirmation open and show the bounded authorization or restore error;
  clear restoring state in `finally`. A source restore is not a target-locale restore workflow.
- **Catalog:** [Existing source drawer stories](../features/version-history/ui/VersionHistoryDrawerView.stories.tsx)
  describe the visual rows and confirmation. Permission/revision semantics remain controller tests.

### Current legal documents and previews

- **Entry / owner:** [Privacy route](<../app/(general)/privacy/page.tsx>), corresponding Terms route,
  `features/policy/public-legal-page.server` and public legal client/query projections.
- **Public read:** Resolve requested locale and one presentation snapshot, render JSON-LD and pass
  matching initial data with the server read timestamp to the client. Metadata and body derive from
  the same presentation read.
- **Token preview:** A token uses the separate preview client path without the public initial snapshot;
  metadata is no-index with no-referrer. History routes stay distinct from current-document routes.
- **Evidence:** The existing legal loading section in [ui-architecture.md](./ui-architecture.md)
  records query-cache/SSR behavior and measurement limits. This UI categorization does not convert
  those deterministic tests into a production loading-time claim.

### Domain editor authority differences

All these editors use a public-family URL plus `?edit=true` and canonical immutable IDs, but their
permissions are domain-specific. A shared header does not grant common editing rights.

| Domain / inspected entry                                                        | Read/edit gate established in source                                                                                                            |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| [Post](<../app/(general)/posts/[idOrSlug]/PostEditRoute.tsx>)                   | Allowed `PostAction.EDIT`, with the archived Author read exception described above                                                              |
| [Work](<../app/(general)/works/[idOrSlug]/WorkEditRoute.tsx>)                   | Admin editing; an Author may reach archived read mode; `canEdit` passed to the editor remains Admin-only                                        |
| [Program Event](<../app/(general)/events/[idOrSlug]/ProgramEventEditRoute.tsx>) | Admin editing; archived Author read exception; editable related lists are fetched only for `canEdit`                                            |
| [Artist](<../app/(general)/artists/[idOrSlug]/ArtistEditRoute.tsx>)             | Require session, then the domain manage action `getArtistAdminAction`; absence becomes not-found. Do not infer all roles from the action's name |
| [Release](<../app/(general)/releases/[idOrSlug]/page.tsx>)                      | Session plus explicit Admin role before resolving/loading the editor                                                                            |
| [Label](<../app/(general)/labels/[idOrSlug]/page.tsx>)                          | Session plus its domain manage query result; slug redirects to the entity ID before editor composition                                          |
| [Page](<../app/(general)/[...slug]/page.tsx>)                                   | Session plus explicit Admin role; manage read, UUID canonicalization and locale-aware editor composition                                        |
| [Form](../app/forms/[slug]/page.tsx)                                            | Session plus explicit Admin role; UUID canonicalization and tab/submission boundary described above                                             |

This matrix reflects the inspected Web routing checks. Server actions/services remain the mutation
and disclosure authority, including any more detailed domain rules.

### Translation source, targets and generation

- **Owner:** [EntityTranslationsPanel](../features/translation/EntityTranslationsPanel.tsx), locale
  commands/data adapters and each domain editor's locale-room authority.
- **Inputs:** Supported entity type/ID, `canManage`, `canAdministerTranslations` and `canMutateTargets`.
  These flags govern different operations; the last two default from `canManage` and must still be
  projected correctly by each caller.
- **Actions / ordering:** Source-locale change and regeneration flush pending editor saves and persist
  the matching runtime before sending commands. A failed flush prevents the command. A successful
  source change updates the active edit-locale URL. Missing-target creation and target deletion check
  `canMutateTargets`; deletion has confirmation.
- **Job state:** Active jobs are projected by locale. Generation availability, source presence,
  eligible locale set and existing active job determine disabled/available actions. Cancellation has
  its own pending/error and refresh behavior. Target presence and job lifecycle remain separate UI
  concepts; do not invent a target lifecycle based on job status.
- **Authority / preview boundary:** Prop flags disable/hide actions but the service enforces them.
  Catalog samples can show locale choices, target presence and job badges; real saves, snapshots,
  source changes, target creation/deletion and generation belong to the controller.

### Campaign recipients, test send and scheduling

- **Entry / owner:** [Campaign route](<../app/(general)/campaigns/[id]/page.tsx>),
  [CampaignEditPage](../features/campaign/CampaignEditPage.tsx), delivery command adapters,
  [recipient scope control](../features/campaign/CampaignRecipientScopeControl.tsx) and
  [delivery dialogs](../features/campaign/CampaignDeliveryDialogs.tsx).
- **Entry:** Resolve a campaign through the domain action, require the edit query mode and use the
  shared Page fallback for absent data. Delivery rights and supported statuses are established in
  controller/service boundaries, not by the presence of a Send button.
- **Recipient input:** `SUBSCRIBED_USERS` or `ALL_MATCHING_USERS`, with a visible warning for the latter.
  The control accepts only those values and cannot deselect to an undefined scope.
- **Send sequence:** Test send requires a nonempty email and persists editable content first. Send-all
  additionally checks the complete audience target and avoids pending configuration writes both
  before and after persistence. Send receives the current recipient scope.
- **Schedule sequence:** Convert the date/time input, require a complete audience and settled
  configuration, persist, then send the instant plus recipient scope. The
  [schedule view](../features/campaign/CampaignScheduleForm.tsx) disables its action while date or
  time is missing and repeats the audience/unsubscribed-recipient warning.
- **States:** Loading/read error, editable versus status-limited campaign, pending configuration,
  missing audience, missing date/time, sending/scheduling/canceling and command failure. Preview
  interactions should use local confirmation/results and never send an actual email.

### Map readiness, directions and print surface

- **Owner:** [MapLibreMap](../features/map/MapLibreMap.tsx) resolves translations/accessibility names
  and site loading UI; `MapLibreMapRuntime` owns browser/map behavior;
  [MapLibreMapView](../features/map/ui/MapLibreMapView.tsx) owns the prop-driven composition.
- **Inputs / result:** Height, background, map surface, readiness/loading slot, attribution items,
  optional directions/provider choices, print image, callbacks and container ref. The view renders
  the actual map slot regardless of readiness, covers it with the loading surface until ready and
  exposes the provided direction controls only when directions are present.
- **Authority / states:** Locale labels and loading stages belong to the controller; WebGL, map
  instance, directions handling and print capture belong to the runtime. Empty place lists are valid
  viewport data, not evidence that the map should collapse to a placeholder. Provider-icon colors
  are external brand assets and must not be blindly collapsed into interaction color tokens.
- **Catalog:** [Existing map view story](../features/map/ui/MapLibreMapView.stories.tsx) supplies a local
  map surface. It verifies composition states separately from actual map readiness, tile fetches and
  geometry. Place editing/search policies remain in the Place/Location features.

### Image selection, crop and upload presentation

- **Owner:** [ImageUploadCropController](../features/upload/ImageUploadCropController/ImageUploadCropController.tsx)
  wraps Core `ImageUploadCropField`; `useImageUploadCrop` owns browser preparation, while each domain
  supplies actual upload/removal persistence.
- **Inputs / action:** Existing image URL, edit permission, upload/removal state and progress,
  upload type, allowed MIME types, size and aspect-ratio policy. Selection enters the shared crop
  preparation; crop confirmation yields a Blob through `onUpload`, and removal delegates to `onRemove`.
- **Result / states:** Empty/read-only, selected/cropping/processing, uploading with indeterminate
  preparation until positive progress, determinate progress and removal pending. Too-large and
  invalid-type rejections produce translated policy messages.
- **Boundary:** Core receives labels, callbacks and visual policy inputs. It does not decide the
  owning domain's persistence or import its service contract. Browser image decode/crop support
  remains runtime verification beyond a fixed upload-field preview.

### File download policy and exact relation ownership

- **Owner:** [FileDownloadPolicyEditor](../features/media-download/FileDownloadPolicyEditor.tsx), its
  adapter/coordinator and the consuming media domain.
- **Policy target:** Entity type/ID, block ID, relation path and expected File ID. A loaded or saved
  policy must match that exact relation; mismatch enters stale/reload-required state rather than
  applying another relation's permissions.
- **Inputs / actions:** Disabled, public, authenticated or segment-restricted audience. Selected
  scope and segment IDs feed coordinated writes with the observed policy snapshot. Segment search
  and incremental loading have their own request state.
- **States / authority:** Loading, disabled by missing enablement, stale target, saving, segment
  loading, saved/error and observed-state reconciliation. Download audience is durable content
  policy, not a visual theme choice. The adapter/service remains authoritative; sample controls must
  not make the same File downloadable across every relation.

### Executable control composition

- **Owner:** [ExecutableRuntimeControls](../features/executable/ExecutableRuntimeControls.tsx) plus
  the p5.js, Three.js or shader runtime that supplies its callbacks.
- **Inputs / actions:** Engine type, running state, Run/Stop/Restart, optional original reset,
  source disclosure, copy, Apply, audio and declared capability control.
- **Visual behavior:** Run and Stop share one position based on running state. Source/audio controls
  expose pressed state; reset and Apply use their supplied disabled state. Labels also provide the
  icon controls' accessible names and tooltips. Starting/running/stopped/error is a separate runtime
  status projection.
- **Authority / result:** This row delegates commands; it does not decide whether source edits are
  persisted, public temporary preview edits, or browser device permission requests. Existing
  domain/runtime documentation retains those rules. Browser capabilities and resource cleanup need
  runtime tests/manual verification, not a mocked button catalog.

## State profiles and preview acceptance

These profiles specify what a feature's UI review should inspect. They are requirements, not a claim
that every current component already implements or previews every state. Components should expose only
states that correspond to real product behavior; generic profiles must not invent unsupported actions.

| Profile       | Relevant review states                                                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Primitive     | Default, hover, keyboard focus, active/selected, disabled; label and accessible name; semantic tone/emphasis; supported size                      |
| List          | Loading, load failure/retry, empty, populated, filtered no-results, selection, sorting/pagination, pending/failed mutation                        |
| Detail        | Loading, error, not-found/restricted where supported, sparse/full/long data and available actions                                                 |
| Editor        | Bootstrap/sync, read-only/permission loss, pristine/dirty, validation, pending/failed save, source/locale boundaries and destructive confirmation |
| Flow          | Initial, pending, success, failure, retry/cancel where supported; reauthentication and continuation when applicable                               |
| Localization  | Requested existing locale, missing target/source fallback, long labels, RTL where supported; neutral structure versus locale text ownership       |
| Share/access  | Ordinary public mode, validated token, password-required, invalid/expired token and restricted destination                                        |
| Runtime/media | Loading/readiness, stopped/running/error, missing/unavailable media, declared capabilities and cleanup where the runtime supports them            |

Every UI Kit level uses the same production Core and Feature views and the same theme/token authority:

1. **Parts:** Canonical control API and visual states, plus actual keyboard/pointer behavior.
2. **Combinations:** Repeated arrangements such as Field + Input, action footer, table toolbar, search
   filter and settings section; callbacks and state are explicit.
3. **Page compositions:** Representative full compositions with sample props and isolated local state.
   Their data adapters demonstrate inputs and results without importing server actions, issuing real
   mutations, fabricating permissions or hiding runtime limitations.

The current architecture and kit registry determine which interactive adapters are permitted.
Component stories are not an alternative place to own production routing, persistence or collaboration.
The JSON's `preview` links point to named Storybook variants; its `args`/props evidence is bounded to
local source declarations, so inherited Mantine APIs and dynamically generated variant matrices require
source inspection.

## Coverage gaps and maintenance

- Static indexing is exhaustive within its stated roots, but runtime workflow verification is not.
  Detailed controller behavior for every taxonomy domain must be confirmed from its source/tests when
  touched. Source coverage and runtime verification are separate checks.
- Direct story imports are deliberately not labeled route coverage. A route may have nested visual
  coverage that the index does not traverse, and a shared primitive story does not constitute a page
  composition preview.
- Review repeated exported names in [component-inventory.md](./design-system/component-inventory.md).
  Compatibility entrypoints and domain-specific meanings may need the same name; merge only after
  confirming semantics, state and authority match.
- Core families with no story file in their directory appear explicitly in the generated family table.
  Importing Feature stories may already compose those controls; that relationship is recorded per
  component in JSON. Missing dedicated states remain visible rather than estimated as covered.
- Run `node scripts/design-system/inventory.mjs` after adding/removing source, exports, routes or stories.
  Run `node scripts/design-system/inventory.mjs --check` in verification. Add a category for new
  domains and update this workflow specification when the actual user behavior or authority changes.
- Use the regenerated import totals when reporting source status. `directMantineImports` in JSON gives
  exact current value-import sites; enforcement ownership and migration debt belong to the current
  token/Core rules and their checker.
