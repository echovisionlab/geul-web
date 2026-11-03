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

## Placement

Both components accept the same placement contract:

| Property    | Default                          | Behavior                                                                                         |
| ----------- | -------------------------------- | ------------------------------------------------------------------------------------------------ |
| `placement` | `fill`                           | `fill` uses absolute positioning with inset zero; `flow` reserves space in normal document flow. |
| `height`    | `100%` for fill, `auto` for flow | An explicit value overrides either default.                                                      |
| `minHeight` | `200`                            | Reserves a minimum region height; use `0` when the containing map/table already reserves height. |
| `size`      | `md`                             | Existing image sizes remain 48/64/80/100/120 for xs/sm/md/lg/xl.                                 |

Existing map/table consumers retain fill behavior. The containing element must establish the intended
positioned region and reserve its height. Fill does not itself reserve document space. A new section
replacement can use flow without feature CSS to override Core positioning:

```tsx
<PageLoader placement="flow" minHeight={200} />
```

The flow variant uses relative positioning with automatic insets and an automatic default height.
It occupies only its own document region. An explicit percentage height still depends on the
parent's height. Choose a minimum height appropriate to the section; placement does not disable
other controls or manage focus.

Pure Feature Views receive a controller-supplied `loadingSurface` or existing content slot. They
must not import the site controller to resolve settings or translations. Core tables retain their
`loadingContent` slot and reserved-height container.

## Catalogue bootstrap

`CatalogueLoadingFallback` supplies the localized loading message and the root-resolved image
directly to Core. It does not call a manifest hook: `ManifestProvider` is below this bootstrap
boundary. Catalogue failure still shows the localized error and retry action. Background prefetch
keeps the current page visible, and route/locale cancellation remains provider-owned.

Buttons, field validation, uploads, measured processing, playback buffering, incremental loading
and route progress retain their existing granular feedback.

## Review surfaces and checks

- `Core/Feedback/PageLoaderView`: default text, phase text, configured image, failed image and flow
  region with content before and after it.
- `Feature/Site/PageLoader`: actual controller/Core path with a local manifest fixture; Controls
  expose the image URL, phase and placement.
- `Foundations/Catalogue Boundary`: actual bootstrap fallback, configured image, failed image and
  error-to-pending retry view before a manifest provider exists.

Stories use an existing static local image. Controls accept an observed public GIF without storing
its production URL in source. Missing-image examples intentionally request a missing local GIF.
The provider's deferred-promise tests cover completion, locale changes, cancelled requests and
retry recovery. Component tests cover visible text, image failure/source changes, deterministic
CDN/GIF handling and placement defaults. Browser review must still verify actual containing
regions, motion, spacing and announcements; DOM assertions do not establish visual approval.
