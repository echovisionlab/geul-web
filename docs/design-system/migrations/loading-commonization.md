# Loading commonization migration

This unreleased change reuses the `/works` map's site `PageLoader` → Core `PageLoaderView`
composition for blocking page and section waits: the configured image above compact localized text.
Read the [loading contract](../loading-surface-contract.md) for the authoritative presentation API.
The design system is not a separately versioned package; the source and documentation change together.

## Select the wait scope

| Wait                                                                                   | Consumer rule                                                                                               |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Initial page, section, editor or preview without usable content                        | Supply site `PageLoader` through the controller's loading/content slot.                                     |
| Existing content being refreshed                                                       | Keep that content and use local busy/update feedback. A failed refresh must not claim the content is empty. |
| Additional list page                                                                   | Keep existing items and use NearEndLoader or the existing load/retry command.                               |
| Button, row command or input lookup                                                    | Use Core command loading or field checking; distinguish pending from settled no-results.                    |
| Upload, transformation, attachment save or resume lookup                               | Preserve local phases, progress, cancel/retry and target identity through the whole operation.              |
| Playback buffering, navigation, background synchronization or invisible infrastructure | Retain its existing task-specific owner; classify the actual wait before changing its presentation.         |

Core Spinner and Skeleton remain available for granular feedback and geometry. Shared page-block
adapters retain hidden structural placeholders where needed to reserve collection space; the visible
wait uses PageLoader. A null helper result, permission omission, JSON-LD boundary or native image
loading attribute does not alone identify a missing loading surface.

## Visible text and placement migration

Previously, site PageLoader suppressed generic loading text and Core allowed an omitted message.
An absent or failed image could leave a visually blank status. Site now resolves an omitted, empty
or whitespace `message` to `common.states.loading`; an explicit generic message remains visible.
Core now requires a nonblank visible `message` and throws for blank text. Update direct Core callers:

```tsx
<PageLoaderView
  imageSrc={resolvedImage.src}
  imageUnoptimized={resolvedImage.unoptimized}
  imageAlt={loadingName}
  message={phaseMessage}
/>
```

Resolve both strings in the owning controller. `imageAlt` names the image/status and does not supply
visible copy. Ordinary product callers continue to use site `PageLoader`, whose `message` remains
optional. The first nonblank configured image is selected deterministically; GIF/SVG delivery stays
unoptimized. Image failure removes that source and retains text without rotating to another image.
There is no bundled fallback GIF.

`fill` remains the default: absolute positioning with inset zero, `height="100%"` and `minHeight={200}`.
Its parent must establish the intended containing region and reserve height. Use `minHeight={0}` only
when the existing map/table container already reserves it. New section replacements can reserve their
own space with `flow`, whose default height is `auto`:

```tsx
<PageLoader placement="flow" minHeight={200} message={phaseMessage} />
```

Retain an existing region's geometry rather than adding feature CSS to override Core positioning.
Placement does not manage focus, disable controls or infer a terminal error state.

## Controller and View migration

Site owns manifest settings, CDN resolution and localized copy. Core remains independent of those
services. Pure Feature Views receive the prepared surface through `loadingSurface` or an existing
state-content slot; they must not import the site controller or translation services to create it.
The existing map composition provides the pattern:

```tsx
// Request-owning controller
<FeatureView
  pending={pending}
  loadingSurface={<PageLoader placement="flow" minHeight={200} message={phaseMessage} />}
/>;

// Pure View
function FeatureView({
  pending,
  loadingSurface,
  content,
}: {
  pending: boolean;
  loadingSurface: React.ReactNode;
  content: React.ReactNode;
}) {
  return <section aria-busy={pending}>{pending ? loadingSurface : content}</section>;
}
```

This replacement branch is for a wait without usable content. Preserve snapshots, rows, diagrams and
previews during background requests. Separate initial pending, successful empty results, terminal
failure and retry; loading must end when a request fails. The controller still owns request identity,
obsolete-response suppression, cancellation policy and any post-request navigation/save barrier.

Core DataTable retains `loadingContent`; feature table adapters supply PageLoader inside its reserved
region. Server navigation aggregates filter/sort/page/refresh pending. In
[ServerDataTableContent](../../../features/data-table/ServerDataTable/ServerDataTableContent.tsx),
`showPendingLoader` defaults to `result.data.length === 0`: existing rows remain visible during
navigation, while an empty table can show PageLoader. `false` always retains the row/empty view;
`true` explicitly replaces rows while pending. Busy/result announcements remain connected in either
mode. Do not force `true` for a background refresh with usable rows.

Catalogue bootstrap is a separate dependency boundary: `CatalogueLoadingFallback` passes localized
text and the root-resolved image directly to Core because ManifestProvider is below it. Preserve its
error/retry and background-prefetch behavior. Do not move access/visibility checks behind a new
Suspense boundary merely to show a loader. A feature fallback does not cover earlier server awaits.

## Command and field migration

| API                                                                             | Required consumer change                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Button, IconButton, SaveButton                                                  | Continue supplying their controlled `loading`; include required preparation/save work in that lifetime.                                                                                                                                                 |
| TextButton command                                                              | Replace disabled-only request feedback with `loading` and optional localized `loadingLabel`. Text and focus remain; activation and native submit/reset are blocked. Link variants reject these props.                                                   |
| TableRowMenu item                                                               | Return `void \| Promise<unknown>` from `onClick`; return the whole Promise for automatic trigger pending and duplicate-command protection. Supply `onError(error)` for domain feedback; otherwise failures are logged.                                  |
| EditorHeader `onBack`, ErrorPage command `onClick`, ImageUploadField `onRemove` | Return the asynchronous operation instead of discarding it. These Core owners track the returned Promise; synchronous callbacks cannot expose later work.                                                                                               |
| MenuToggle                                                                      | Pass controlled `loading` for navigation preparation. The caller owns opening, cancellation and completion.                                                                                                                                             |
| SearchComboboxView                                                              | Keep `isLoading` connected to the actual lookup. It retains checking feedback and suppresses minimum-query/no-results copy during pending; validation errors retain their separate meaning.                                                             |
| MultiSelect                                                                     | Pass `isLoading` (inactive when omitted) and optional localized `loadingLabel`. Pending uses the shared checking glyph, sets busy state and suppresses `nothingFoundMessage`. It does not disable existing options or selected pills.                   |
| MultiSelectComboboxView                                                         | Connect `isLoading` to querying and `isCreating` to creation. Either flag shows field checking and suppresses empty/not-found copy; creation requires `canEdit`, `canCreateNew`, `onCreate`, a nonblank query, no exact match and neither pending flag. |

For a row command, return the Promise rather than starting detached work:

```tsx
const item = {
  label: actionLabel,
  onClick: () => performAction(),
  onError: (error: unknown) => showActionFailure(error),
};
```

These contracts do not turn a synchronous router callback into a navigation-completion Promise.
The request owner must connect its actual transition or completion boundary. Error feedback and
retry remain domain-owned. Upload progress must continue through attachment/configuration save;
recovery lookup pending/error/missing-session states are local recovery information, not a page wait.

TextButton's `loading` defaults to `false`; without `loadingLabel`, its progress name follows the
control's accessible name or visible label. MenuToggle's omitted `loading` is inactive. The shared
[pending-action helper](../../../components/core/use-pending-action.ts), used by EditorHeader Back,
ErrorPage commands and ImageUploadField removal, returns the Promise's resolved value or original
rejection while clearing pending in either case. It separately logs rejected event-handler work;
callers still own domain feedback. This does not describe TableRowMenu's separate `onError` contract.
ImageUploadField combines returned-Promise pending with controlled `removeButtonLoading`, whose
default remains `false`.

EditorHeader's required `onBack` and ErrorPage's command `onClick` accept
`() => void | Promise<unknown>`. ErrorPage actions choose either `href` or `onClick`; they cannot
supply both. ImageUploadField's optional `onRemove` accepts `() => void | Promise<void>`.
TableRowMenu items accept optional `onClick: () => void | Promise<unknown>` and
`onError: (error: unknown) => void`; its `aria-label` and `items` props remain required.

[MultiSelectComboboxView](../../../components/core/Input/MultiSelectComboboxView.tsx) requires
`label`, `placeholder`, `emptyMessage`, `notFoundMessage`, `selectedItems`, `options`, `onSelect`,
`onDeselect`, `createOptionLabel` and `canEdit`. `isLoading`, `isCreating`, `loadingLabel`,
`canCreateNew`, `onCreate`, `combineWithSelected` and `idPrefix` are optional. Omitted pending flags
are inactive; omitted `canCreateNew` disables creation, and `combineWithSelected` defaults to `false`
in the state hook. Use it when selected items may be absent from query results so their names remain
available. Direct MultiSelect callers supply their own localized `loadingLabel`; without one, the
checking glyph is decorative and the field still exposes busy state. The
[post taxonomy wrapper](../../../features/post/MultiSelectCombobox.tsx) supplies `common.states.loading`.
Loading preserves available options and selection/removal behavior; it only gates new-item creation
in this View. A creation failure must clear `isCreating` and expose caller-owned error/retry feedback.

## On-demand modules and confirmation recovery

[useOnDemandModuleState](../../../components/core/on-demand-module.ts) accepts
`(module, needed, request?)` and returns `{ module, status, error, retry }`. Its status is `loaded`
when a module is cached, `idle` when no module is available and `needed` is false, `pending` through
loading/backoff, and `error` after automatic retries are exhausted. A failed initial request retries
after 500, 2000 and 5000ms. `error` exposes the final failure only in the error state; otherwise it is
`undefined`. `retry()` starts another round without replacing the queued intent. A changed `request`
or an `online` event also starts a round while waiting. The compatible `useOnDemandModule` hook keeps
returning only the module or `undefined`; use the state hook for terminal failure/recovery UI.
`onDemandModule.load()` preserves rejection, `preload()` settles without rejecting, and `peek()` reads
the cached module without loading it.

[ConfirmDialogHost](../../../components/core/Modal/confirm-dialogs.tsx) now requires localized
`loadError: { message: string; retryLabel: string }`. Update every host, including eager fixtures:

```tsx
<ConfirmDialogHost loadError={{ message: loadFailureMessage, retryLabel }} />
```

`loading` defaults to `"on-demand"`; `"eager"` begins loading on mount for stories/tests. The first
queued confirmation shows RouteProgressBar without moving trigger focus. When retries are exhausted,
the progress bar ends and `ConfirmDialogLoadError` renders a shared danger Alert with cancel/retry
Buttons. The latest queued dialog supplies its title and cancel label; `loadError` supplies failure
copy. The exported recovery view requires `title`, `message`, `retryLabel`, `cancelLabel`, `onCancel`
and `onRetry`. Recovery receives focus and restores the original trigger before the loaded dialog mounts.
Retry reloads the renderer; it never invokes `onConfirm`. Cancel closes the current queued request.
The queue survives failure, and explicit retry, a new request or coming online can recover it.
Normal preloaded stories do not establish the cold-chunk path; the
[RendererLoadError story](../../../components/core/Modal/ConfirmModal.stories.tsx) renders the
production recovery view directly.

## Authentication and tool startup

[LoginFlowView](../../../features/auth/LoginFlowView.tsx) and
[VerificationFlowView](../../../features/auth/ui/VerificationFlowView.tsx) require a controller-supplied
`loadingSurface: ReactNode`. Code submission keeps the entered six-digit PIN mounted and disabled,
and shows the supplied site PageLoader with localized submission text. Resending retains its own
button pending state. This preserves the PIN during the request; it does not change settled error,
expiry or resend policies. Explicit email-update authority rechecks keep the `applying` or
`unavailable` result region mounted, show the loader there and keep the Check again command pending.
They do not replace the result or move focus merely because the recheck starts.

[ToolModule](../../../features/page/blocks/embed/ToolModule.tsx) keeps the site PageLoader visible
until both module loading and the returned `mount()` Promise settle. Failure replaces loading with
the localized alert; ready removes the loader. URI changes/unmount abort the active mount and clean
up its host. The [Tool Startup stories](../../../features/page/blocks/embed/ToolStartup.stories.tsx)
exercise production PageContentView → EmbedFrame → ToolModule with a local manifest and external
mount fixture: `Pending`, `Failed`, `Ready`, `FramePending`, `FrameFailed`, `Dark`, `Korean` and
`Mobile` (a 320px content region). `loaderImageSrc` accepts an ephemeral configured GIF in Controls;
the committed default is a static local asset. These fixtures cover waiting/rejection at `mount()`,
not stalled module downloads, real tool requests or the external tool producer's configuration/CSS
loading implementation.

Avatar removal retains the separate [image upload migration](../image-upload-contract.md):
`appearance="media-overlay"` paints a 16px circle with a 12px glyph/spinner within a rectangular
24px fine-pointer / 44px coarse-pointer target. ImageUploadField's avatar appearance requires a
circle preview and inside placement; ProfileAvatarControl selects it for admin/profile images.

## Consumer and story references

These are source and fixture entrypoints, not a claim that the linked browser states passed review.

| Actual consumer                                                                                                                                                                                                              | Story source and represented state                                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Site PageLoader](../../../features/site/PageLoader/PageLoader.tsx) and [catalogue fallback](../../../lib/providers/ClientMessagesProvider.tsx)                                                                              | [Site loader](../../../features/site/PageLoader/PageLoader.stories.tsx): generic, map phase, absent/failed image, flow; [Catalogue Boundary](../../../stories/foundations/CatalogueBoundary.stories.tsx): pending, image and retry                                             |
| [MapLibre map](../../../features/map/MapLibreMap.tsx) and [embedded map](../../../features/map/MapViewEmbedded.tsx)                                                                                                          | [Map View](../../../features/map/ui/MapLibreMapView.stories.tsx): supplied loading slot; [editor preparation](../../../features/map/MapLibreMapEditor.stories.tsx): theme wait and narrow region                                                                               |
| [Collection fallback](../../../features/page/blocks/ListBlockSkeleton.tsx), [map fallback](../../../features/page/blocks/post-map/Skeleton.tsx) and [table fallback](../../../features/page/blocks/TableLoadingFallback.tsx) | [Block Loading](../../../features/page/blocks/BlockLoading.stories.tsx): grid, list, authors, map and table                                                                                                                                                                    |
| [Server table content](../../../features/data-table/ServerDataTable/ServerDataTableContent.tsx)                                                                                                                              | [Server Navigation Wait](../../../features/data-table/ServerDataTable/ServerDataTablePending.stories.tsx): manual completion, error recovery and retained rows                                                                                                                 |
| [Local backups](../../../features/my/LocalBackups.tsx) and [passkeys](../../../features/my/PasskeySettingsSection.tsx)                                                                                                       | [Local Backups](../../../features/my/LocalBackups.stories.tsx): initial loading; [Passkey Settings](../../../features/my/PasskeySettingsSection.stories.tsx): loading, failed, registration pending and unsupported                                                            |
| [Email layout preview](../../../features/admin/email-layout/EmailLayoutPreview.tsx)                                                                                                                                          | [Preview](../../../features/admin/email-layout/EmailLayoutPreview.stories.tsx) and [Email Editors](../../../stories/pages/EmailEditors.stories.tsx): initial/background preview, failure and preparation fixtures                                                              |
| [Video runtime preparation](../../../features/media/VideoPlayer.tsx) and [Mermaid preview](../../../features/mermaid/MermaidDiagram.tsx)                                                                                     | [Video Player](../../../features/media/VideoPlayer.stories.tsx): RuntimePreparation versus Processing/Playback; [Mermaid](../../../features/mermaid/Mermaid.stories.tsx): InitialPreparation and existing source/preview                                                       |
| [File manager](../../../features/file-manager/FileManager.tsx) and [share links](../../../features/share/ShareLinkSection.tsx)                                                                                               | [FileManagerView](../../../features/file-manager/FileManagerView.stories.tsx): usage pending/failure; [ShareLinkSectionView](../../../features/share/ui/ShareLinkSectionView.stories.tsx): InitialLoading, ListFailed and CreateLinkPending                                    |
| [Cookie settings](../../../features/my/CookieConsentSettings.tsx), [post republish](../../../features/admin/post/PostRowMenu.tsx) and [header Back](../../../components/core/EditorHeader/EditorHeaderView.tsx)              | [TextButton](../../../components/core/TextButton/TextButton.stories.tsx): Pending; [TableRowMenu](../../../components/core/DataTable/TableRowMenu.stories.tsx): ReturnedPromise; [EditorHeader](../../../components/core/EditorHeader/EditorHeaderView.stories.tsx): AsyncBack |
| [Profile avatar](../../../features/user/ui/ProfileAvatarControl/ProfileAvatarControl.tsx)                                                                                                                                    | [ProfileAvatarControl](../../../features/user/ui/ProfileAvatarControl/ProfileAvatarControl.stories.tsx): WithImage, AdminWithImage and DisabledWithImage                                                                                                                       |
| [Taxonomy selection wrapper](../../../features/post/MultiSelectCombobox.tsx)                                                                                                                                                 | [MultiSelectComboboxView](../../../components/core/Input/MultiSelectComboboxView.stories.tsx): Loading, LoadingEmpty, Creating, DisabledPending and CreationRetry; the failure simulation releases pending, without contacting a service                                       |
| [Login controller](../../../features/auth/LoginController.tsx) and [verification controller](../../../features/auth/VerificationContent.tsx)                                                                                 | [Login Flow](../../../features/auth/LoginFlowView.stories.tsx): Submitting and Resending; [Verification Flow View](../../../features/auth/ui/VerificationFlowView.stories.tsx): SubmittingCode, RecheckingApplying and RecheckingUnavailable                                   |
| [ToolModule](../../../features/page/blocks/embed/ToolModule.tsx) through [EmbedFrame](../../../features/page/blocks/embed/EmbedFrame.tsx)                                                                                    | [Tool Startup](../../../features/page/blocks/embed/ToolStartup.stories.tsx): pending, failed, ready and 320px content region through the production page/frame path                                                                                                            |

## Audit and acceptance boundaries

The source audit covers all 54 feature domains across account, admin, authoring, catalogue, media and
shell groups, plus platform and support owners. It includes retained granular states, intentionally
invisible infrastructure and domains without independent waits. It does not establish that every
candidate is a defect or that every implementation branch has passed runtime verification.

The [loading source inventory](../loading-inventory.md) describes the read-only collector, source hashes,
import traces and manual classification. AST candidates can overlap one wait; lexical matches can be
non-UI text. Counts depend on the inspected source snapshot and are neither defect counts nor full
semantic proof. Reconcile each owner's disposition with current source after concurrent edits settle.

Review actual production Views and Storybook with slow initial requests, background refresh, errors,
retry, changed targets/locales, reverse completion order and close/unmount. Check configured GIF
delivery/playback, text after image failure, phase changes, fill/flow containing regions, narrow/wide
viewports, themes and localized copy. Loader fixtures default to static local images; map
`rendering` copy is supported but is not emitted by the audited runtime's connecting/loading/ready path.

The coordinator reports direct visual inspection of the actual Works GIF and live PortaDJ ready
state; Storybook review covered common-loader GIF phase/generic text, no-image/failed-image cases,
tool pending/failed/ready and the 320px region, plus the `33steps` avatar and its hover state.
These are the reported observations, not additional browser checks by this documentation worker.
Most other production/Storybook states, physical coarse-pointer input and actual assistive-technology
announcements remain unverified. Focused source/test results do not replace those checks, and their
counts must not be added into a whole-site pass total. This migration records no released web version
or blanket visual approval and does not claim unrelated `/my` information architecture or filter
defects are fixed.
