# Image selection, preparation and upload

## Ownership and usage

`ImageUploadField` owns the named native picker and drop target. `ImageUploadCropField` adds the crop dialog.
`ImageUploadCropController` supplies product labels, source formats, upload type, preparation state and upload callbacks.
Artwork, featured images and social-card backgrounds consume this controller. Avatar and artist controllers consume
`prepareImageFileForPreview` through the same upload policy. `useUpload` owns preparation before transport and
validates the prepared file before starting the upload session.

The controller shows the field name and image surface without a persistent ratio caption, maximum-size caption
or information button. Crop geometry remains in the preview and dialog. Accessible crop handle names,
instructions and selection descriptions remain available; failures and preparation status are still announced.
Optional constraints supplied directly to the domain-free Core crop field remain supported for other tasks.

## Preview and removal

Hug previews (logos) size the preview box, and therefore the remove action's anchor, to the image itself.
`surface` previews theme-specific artwork on its own background (`theme-light`, `theme-dark`) independent of
the app theme. The default outside remove action is a corner badge: an opaque chip centred on the preview's
top-end corner. `ImageUploadField` reserves half the control as a block-start/inline-end gutter whenever a
remove action is offered, so the badge never covers the field label, description or neighbouring fields.
`removeButtonPlacement="inside"` (avatars) keeps the action within the image.

`removeButtonAppearance="avatar"` requires a circle preview and inside placement. It selects Core
IconButton's `appearance="media-overlay"`: a 16px circular visual with a 12px X or pending spinner,
using the existing `icon-size-md` and `icon-size-xs` roles. The rectangular native target stays 24px on fine pointers
and grows inward to the shared 44px coarse-pointer minimum. Its corners accept pointer input across the entire
painted badge. Hover/press affects the visual; keyboard
focus outlines the full target. Disabled/pending preserve the visual and block execution through IconButton.
The strong danger treatment remains an explicit avatar-removal choice.

Use the avatar appearance for profile-photo removal. It does not resize logos, artwork, crop actions,
ordinary media buttons or the global xs/compact sizes. The default appearance retains the existing full-target
treatment. `ProfileAvatarControl` selects the avatar appearance; `UserAvatarUploader` consumes it for account
profiles and the 56px admin `UserProfileFormSection`. The profile control's default image size remains 80px.

## Source and prepared-file policy

Managed raster sources accepted by their upload type are decoded and resized locally before entering the crop dialog.
PNG, JPEG, WebP and AVIF are encoded as WebP; HEIC/HEIF uses the installed local decoder before WebP encoding.
The longest prepared edge is at most 4096 pixels. Encoding starts at quality 0.86 and lowers quality/size when
necessary to satisfy the target's prepared-file limit. The shared tolerance is 30 MiB; smaller targets, such as
client/label logos at 5 MiB, use their own limit. The final upload validator remains authoritative for the output.

Managed originals have no byte-size rejection before this processing. This does not promise that every image can
be decoded on every device: malformed files, missing browser codec support and local memory failures remain
recoverable preparation errors. Strict managed preparation rejects decoding/encoding failure instead of quietly
sending the original. Files are not uploaded when preparation or final validation fails.

GIF, SVG, ICO and upload types that cannot accept the normalized format retain their existing passthrough and
server-compatible size/format restrictions. Animated loader GIFs retain animation and their actual loader-upload
limit. This change does not redefine backend limits or remove upload-session validation.

## Picker and recovery

Native `accept` hints include allowed source MIME types and equivalent filename extensions. This supports valid
source files for which the browser supplies an empty MIME type, including HEIC/HEIF. The native picker is a hint,
not a security boundary; dropped files and selections still pass runtime type and prepared-file validation.
Unsupported source types do not start a crop session. Local preparation is announced, repeat selection is blocked
while preparation runs, and failures leave the picker usable for a new selection.

`ReleaseArtworkView` explicitly supplies `RELEASE_ARTWORK`, rather than inheriting the featured-image default.
Callers with another upload type should pass that type so its source and output policy are used together.

## Review and verification

Review `Feature / Upload / ImageUploadCropController / Square Artwork` for the compact empty surface and native
accept policy. `Artwork Local Preparation` processes a real PNG in the browser, opens the real crop dialog and
closes it with Escape. Its image output remains local to the fixture; no upload or persistent relationship is written.
Review light/dark and named custom themes at mobile, tablet and desktop widths.

Source tests cover oversized originals entering normalization, target-specific prepared limits, strict decoder
failure, bitmap resize/release, MIME/extension hints, controller captions and preparation-state recovery.
Browser fixtures do not establish backend authorization, real upload deployment or native VoiceOver results.

For avatar removal, review Core ImageUploadField / AvatarRemovalComparison and AvatarRemovalStates at 56px and
80px, then Feature User / ProfileAvatarControl / AdminWithImage, WithImage and DisabledWithImage.
The comparison renders the default and avatar appearances side by side; the state fixture exercises badge-edge
hit-testing, removal, keyboard activation, disabled and pending behavior. Core IconButton / MediaOverlayHover and
MediaOverlayActive check that forced hover/active paints only the badge. Review light/dark, hover, keyboard focus,
RTL and coarse-pointer targets. The coordinator owns final browser regression and visual acceptance.

## Migration

Avatar consumers opt in with `removeButtonAppearance="avatar"`, `removeButtonPlacement="inside"` and a circle
preview. `ProfileAvatarControl` supplies these props centrally; account/admin callers need no size overrides.
Other image consumers keep the default appearance. Direct IconButton consumers must supply inside media placement
when selecting `appearance="media-overlay"` and cannot provide a local size or shape.

Before this review, managed sources were rejected above 20 MiB, and non-HEIC sources reached the crop dialog
without normalization. They now enter bounded local preparation before crop and retain final upload validation.
The crop controller's ratio, format and size hints are no longer persistent visual content; explicit crop accessibility
and runtime error information remain. Existing Core props and server upload contracts are preserved.
