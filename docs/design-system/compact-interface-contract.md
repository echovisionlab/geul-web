# Compact product interfaces

Compact presentation uses the existing Core typography, spacing, control sizes and semantic themes.
It changes visible hierarchy and layout together with the production consumers; it is not a Storybook-only scale.
No additional palette or token scale is introduced for these review corrections.

## Shared hierarchy

Use a short primary title, nearby secondary context and a separate action track.
Core Text sm/medium identifies a list item; xs/secondary carries language, version, contributor or time context.
Keep the primary content first in DOM reading order. Passive current/archive state is text, while actionable or
in-progress states retain their relevant control/status contracts. Do not put every metadata value in a filled badge.
Use an explicit compact control size for dense command rows, not a theme-dependent reduction of hit targets.
The existing Core coarse-pointer minimum and keyboard/focus behavior remain.

| Task                          | Shared owner and actual consumer                                                                                                                                                                                     |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Progress and processing       | Core Progress; ProcessingOverlay and RouteProgressBar consume its actual bar. Processing owns the protective media overlay; route owns fixed placement. Optional task/status text uses xs.                           |
| Modal and drawer              | Core OverlayDialog/Drawer compact density, a visible fixed header and a scrolling body. Standard density remains explicit. Map directions and version history consume this contract.                                 |
| Version history               | Primary title, xs context, passive semantic timestamp and an end-aligned restore command. The shared NearEndLoader requests further pages, retains loaded items on failure and provides retry/keyboard continuation. |
| Link creation                 | Named plus IconButton, compact inputs and a plain form track. Narrow social links give the URL track priority and retain a searchable platform picker in a Core Popover.                                             |
| Translation and legal history | Language names without duplicate codes; source identity and meaningful job/error information remain. Current/archive states use plain Text.                                                                          |
| Endpoint and identity         | MCP endpoint terms remain accessible but are visually hidden. Missing/failed site images fall back to site title or LOGO using named Typography sizes.                                                               |
| Image selection               | Supported source hints and recoverable validation; local preparation before managed crop/upload. Prepared server-bound files retain target validation.                                                               |
| Dense reordering              | Stable leading Core targets; motion shells update independently of expensive domain content. Keyboard/sensor/focus behavior remains.                                                                                 |
| Post hero                     | Contained photo geometry, metadata in normal flow and shared inset/gap to the real document body.                                                                                                                    |
| Cookie choice                 | The single optional category is disclosed with two equally available compact text decisions: Reject and Accept all. Account settings retain draft/save semantics.                                                    |

## Rules and boundaries

Accessible names retain control and target context when a visual label is hidden. Icon-only controls require names;
passive metadata must not acquire unrelated extra tab stops. Full timestamps remain accessible independently of hover.
A popup that exceeds a command rail belongs in the existing document portal, with trigger ownership, selection and
focus restoration preserved. Dropdowns scroll within the viewport rather than stretching the toolbar.

Automatic pagination is a transport-aware composition: the feature owns cursor/offset, cancellation, permissions
and error state; Core owns the near-end trigger and continuation affordance. A query replacement must discard stale
responses. Failed pages need an explicit retry, not an automatic request loop. Folder completeness and search paging
are distinct contracts; do not invent a cursor for a non-paginated endpoint.

The avatar removal fill is the user's scoped danger/strong exception. It does not change ordinary upload removal
or general row action defaults. Processing image contrast requires a real dark media/scrim surface.

Review current production stories at mobile, tablet and desktop sizes, both base schemes/custom presets and relevant
UI languages. Source render counts are not native drag latency or FPS; automated axe/keyboard execution is not
assistive-technology or live-service acceptance. The version-history storage audit identifies inspected source,
not the state of a deployed database.

## API and default migration

- Progress `title` is now a visible task title, not a native tooltip attribute; `status` is visible detail linked as the description. Existing explicit accessible names remain required. Use Core Tooltip or a described relationship for separate supplementary information.
- Progress xs uses a 2px bar instead of 4px. Route consumes this slim variant; ordinary progress remains sm. Existing xs consumers, including release track status, inherit the slim bar.
- ContentModal/OverlayDialog/Drawer default to compact density. Choose standard explicitly when its existing spacing is required. Width/placement and media/workspace fit rules are independent of density.
- ProcessingOverlay accepts the shared Progress contract in its progress slot. Route owns only phase/fixed placement, and callers migrate the old estimated numeric presentation to its phase contract.
- NearEndLoader callers provide an opaque next-page key, result-set reset key and an async load operation. Feature adapters preserve pending/error state and protect against stale queries.
- ImageUploadField `removeButtonEmphasis` adds only medium/strong; medium remains the default. Avatar is the explicit strong consumer.
- The cookie banner migrates draft/save callbacks to direct acceptance/rejection. Account settings retains draft/save behavior; consent storage/version is unchanged.

## Detailed contracts

- [Overlay density](./overlay-density-contract.md)
- [Link management](./link-management-pattern.md)
- [Version history](./version-history.md)
- [File browser](./file-browser.md)
- [Translation, identity and history](./translation-identity-history-contract.md)
- [Image upload](./image-upload-contract.md)
- [Sortable rendering](./sortable-performance.md)
- [Post hero](./post-hero-contract.md)
- [Cookie consent](./cookie-consent-contract.md)
