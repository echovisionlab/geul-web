# Common loading surface

Blocking page and section waits use the existing site `PageLoader` → Core `PageLoaderView` path.
The `/works` map reference supplies the composition: a configured image centered above compact,
localized phase text, with no card behind the message.

`PageLoader` owns manifest settings, CDN resolution and translation. It selects the first nonblank
`settings.loader_urls` entry deterministically and preserves GIF/SVG delivery with `unoptimized`.
The Core view owns image rendering, failure handling, typography and placement. It does not read
site settings or collect pending state.

## Visible text and recovery

The site controller displays `common.states.loading` when `message` is omitted, empty or whitespace.
An explicit generic message remains visible. A distinct phase replaces that generic text; changing
phases updates the existing status region. Core requires a nonblank visible `message` and rejects
blank strings. Its required `imageAlt` names the image and status independently; Core never derives
visible text from that accessible name.

Direct Core callers must now pass `message` explicitly, including default stories and tests.
The two production consumers already do: site `PageLoader` resolves the localized default or
trimmed phase message, and `CatalogueLoadingFallback` supplies the localized bootstrap message.
Site `PageLoader.message` remains optional; owners resolve visible copy before passing it to Core.

Without a configured image, the surface displays text alone. A failed image is removed while the text remains. Failure
does not rotate to another configured image. A different configured source can render afterward.
The status keeps its accessible name and implicit live announcement behavior; it does not set
`aria-busy` on itself, which would defer its own pending announcement. The requesting controller or
containing view owns busy state, request cancellation and terminal error/retry UI.

## Contrast

Core and site loaders accept `contrast="standard" | "inverse"`, defaulting to `standard`.
Standard uses the existing theme `text-muted` role. Inverse uses the full-strength, theme-invariant
`text-on-image` role for text on a dark scrim; it does not add a surface or change placement.
Core owns both colors. Callers select contrast instead of supplying styles, classes or colors.

Both the [standalone public form](../../features/form/PublicFormView.tsx) and
[embedded form block](../../features/page/blocks/form/ViewClient.tsx) explicitly select inverse on
their submission scrims through [FormSubmissionPendingState](../../features/form/FormSubmissionState.tsx).
The shared submission state defaults to standard for callers that do not request inverse.
The existing 55% black dialog overlay over the Light surface produces approximately `#706f6e`.
Full white text has 5.01:1 contrast there; the 88% white `text-inverse-primary` role would reach only
4.31:1. Light and Dark tests check both standard theme surfaces and the composed inverse overlay.
The overlay's layout, admitted fields and interaction remain owned by the form.

## Placement

Both components accept the same placement contract:

| Property    | Default   | Behavior                                                                                         |
| ----------- | --------- | ------------------------------------------------------------------------------------------------ |
| `placement` | `fill`    | `fill` uses absolute positioning with inset zero; `flow` reserves space in normal document flow. |
| `extent`    | `section` | Named region height owned by Core. See below.                                                    |
| `size`      | `md`      | Existing image sizes remain 48/64/80/100/120 for xs/sm/md/lg/xl.                                 |

| Extent      | Region                                                                              |
| ----------- | ----------------------------------------------------------------------------------- |
| `container` | Follows a parent that already reserves height, such as a map, table or media frame. |
| `compact`   | Panel, dialog or list slot.                                                         |
| `section`   | Page section or editor entry.                                                       |
| `tall`      | Workspace whose content is known to be tall, such as a full editor or file manager. |
| `viewport`  | Standalone full-screen route.                                                       |

Numeric `height` and `minHeight` are not part of the public type; a region that needs another size
needs a reviewed extent. Fill does not itself reserve document space; the containing element must
establish the positioned region. A new section replacement uses flow without feature CSS:

```tsx
<PageLoader placement="flow" extent="compact" />
```

Placement does not disable other controls or manage focus. Regions whose geometry is already known
(list blocks, ordered credit rows, table rows) keep Core Skeleton; do not hide a skeleton under a
loader to reserve space. Rows, dialogs and fields keep Spinner or field `isLoading`.

Pure Feature Views receive a controller-supplied `loadingSurface` or existing content slot. They
must not import the site controller to resolve settings or translations. Core tables retain their
`loadingContent` slot and reserved-height container.

## Video runtime preparation

Core [MediaVideoFrame](../../components/core/MediaControls/MediaVideoFrame.tsx) accepts optional
`preparing` and `processing` flags, both defaulting to `false`. Its
[CSS](../../components/core/MediaControls/VideoControls.module.css) reserves the initial 16:9 region
only while either flag is active and no descendant `video` or `.video-js` is present to supply sizing.
The empty mount inherits that ratio. Once either media element exists, the reservation stops applying;
standard loaded-media sizing remains owned by the Video.js fluid runtime or native video. Core does
not force loaded media into 16:9.

[VideoPlayerView](../../features/media/ui/VideoPlayerView.tsx) requires `preparing`, forwards both
flags to Core and sets the mount's `aria-busy` from `preparing`. It renders `loadingSurface` only
for `preparing && !processing`; processing takes priority and renders `processingSurface` instead.
The [VideoPlayer controller](../../features/media/VideoPlayer.tsx) owns preparation identity and
completion through runtime loading and mounting, including the native fallback. It supplies site
`PageLoader` with localized loading text, `contrast="inverse"`, fill placement and `extent="container"`.
Core reserves the containing region and paints its fixed black background with the existing
`canvas-black` role, so loader contrast stays inverse in both themes.

Preparation ends at runtime/native mounting, independently of media metadata or playback buffering.
The [Video.js runtime](../../features/media/runtime/videojs-player.ts) retains loaded-media sizing
and playback behavior; processing retains its existing media status overlay.

## Catalogue bootstrap

`CatalogueLoadingFallback` supplies the localized loading message and the root-resolved image
directly to Core. It does not call a manifest hook: `ManifestProvider` is below this bootstrap
boundary. Catalogue failure still shows the localized error and retry action. Background prefetch
keeps the current page visible, and route/locale cancellation remains provider-owned.

Buttons, field validation, uploads, measured processing, playback buffering, incremental loading
and route progress retain their existing granular feedback.

## Review surfaces and checks

- `Core/Feedback/PageLoaderView`: default text, phase text, configured image, failed image, inverse overlay and flow
  region with content before and after it.
- `Feature/Site/PageLoader`: actual controller/Core path with a local manifest fixture; Controls
  expose the image URL, phase, contrast and placement.
- `Foundations/Catalogue Boundary`: actual bootstrap fallback, configured image, failed image and
  error-to-pending retry view before a manifest provider exists.
- [Video Player stories](../../features/media/VideoPlayer.stories.tsx): `RuntimePreparation`,
  `Processing` and `Playback` distinguish initial reservation from processing and loaded playback.

Stories use an existing static local image. Controls accept an observed public GIF without storing
its production URL in source. Missing-image examples intentionally request a missing local GIF.
The provider's deferred-promise tests cover completion, locale changes, cancelled requests and
retry recovery. Component tests cover visible text, image failure/source changes, deterministic
CDN/GIF handling, contrast selection and placement defaults. Browser review must still verify actual containing
regions, motion, spacing and announcements; DOM assertions do not establish visual approval.
