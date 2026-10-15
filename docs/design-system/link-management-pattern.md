# Link management composition

This pattern uses existing Core contracts in the production share-link and social-link editors. It adds no tokens or Core presentation variants.

## Share links

`features/share/ui/ShareLinkSectionView.tsx` owns the section composition; `features/share/ShareLinkSection.tsx` owns expiry policy, authorization inputs, requests, clipboard actions and notifications.

The section header uses a compact IconButton with a `+` glyph and the localized new-link accessible name. Tooltip provides supplementary text. Expanded/controls relationships identify the form. Opening moves focus to the label field; closing returns focus to the trigger.

The inline creation form uses a plain SectionCard, named group, compact xs inputs and shared xs gaps. Label/password fields share a two-column LayoutGrid from `sm`, with a single column below it. Expiration and the conditional custom date use the same adaptive layout. The maximum-expiry guidance is associated with the expiration input. Cancel/create retain neutral low/medium command emphasis; this inline form does not adopt a Dialog primary-action exception.

This reduces the separate muted panel, padding and stacked field height while keeping visible labels. Core still owns control sizes, coarse-pointer targets, typography and feedback. Custom-date limits, password handling, request state and expired-link behavior remain in their existing owners.

Review `Feature/Share/ShareLinkSectionView`: Default, CreateLink, CreateLinkCustomDate, CreateLinkPending, Disabled, CreateLinkNarrowViewport and KeyboardLinkManagement. View stories model local changes; the production controller and service tests establish request behavior separately.

## Social links

`features/social-links/ui/SocialLinkInputView.tsx` owns placement. `SocialLinksEditor` and `useSocialLinksEditor` retain value normalization, ordered data, maximum count and callbacks.

At available row widths below the registered `xs` breakpoint, the selected platform appears as a Core SocialIcon in a compact IconButton. URL input receives the flexible track. The selected platform remains in the trigger and URL input accessible names. Wider rows retain the named, searchable Select.

The compact trigger opens a named Core Popover containing the existing searchable Select. It preserves option labels and selection callbacks. The full and compact wrappers switch with a container query; `display: none` removes the inactive branch from keyboard and accessibility navigation. The picker uses distinct IDs. Resize handling closes an open compact picker when its trigger is no longer visible and moves focus to the full Select.

Review `Feature/Social Links/Editor`: Desktop, Narrow, DisabledNarrow and NarrowPlatformSelection. Check search focus, nested option selection, Escape dismissal, focus return, label changes, URL editing and reorder controls. A narrow row on a desktop viewport must use the compact presentation too.

## Verification boundaries

Unit tests exercise naming, callbacks, permissions, pending/custom-date guards, nested search/dismissal and focus restoration. Browser stories verify actual container visibility and input allocation. Review mobile, tablet and desktop, light/dark/custom themes, translated labels, RTL and coarse-pointer targets. DOM tests alone do not establish geometry, contrast or assistive-technology behavior.
