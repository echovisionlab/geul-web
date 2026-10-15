# Dialog density and scroll ownership

Core dialog chrome defaults to compact density. ContentModal and Drawer expose the
closed `density="compact" | "standard"` choice; density changes spacing and title type,
while `size` continues to control width or drawer height independently.

Compact header and body padding use `spacing-xs`; the title uses `font-size-sm` and
`line-height-sm`. Standard density retains `spacing-md`, `font-size-md` and
`line-height-md`. These existing roles also apply to FormModal, ConfirmModal and
BlockingAlertDialog through their shared OverlayDialog owner. Action tone, emphasis,
control geometry and dismissal behavior are unchanged.

The panel stays within its viewport budget and forms a flex column. Its dialog and
body can shrink; the header does not shrink or scroll. The body is the scrolling
owner for long content. When it overflows, it becomes a keyboard-focusable region
named by the visible dialog title, with an inset focus outline. Resize and content
observation update that state as the viewport or content changes. Short bodies and
`bodyLayout="fit"` do not acquire another tab stop. Native arrow, Page Up/Down and
Home/End keys remain available; Core does not replace them with scripted scrolling.
Features should compose their rows and status within that
body rather than add another full-height scroller. `bodyLayout="fit"` remains the
explicit ContentModal contract for media or workspace content that owns its internal
shrinking behavior. Workspace bodies keep their existing zero-padding rule.

Desktop modal insets, mobile safe-area handling, named sizes and drawer placement
presets retain their existing geometry. Compact density does not change the viewport
breakpoint or remove a touch target's minimum.

Core ContentModal and Drawer include long-content and phone stories. Their play checks
measure body overflow, body scrolling, header position and visible close controls.
Unit and keyboard tests cover density selection, pending dismissal, focus containment
and restoration. Browser runs supply the layout evidence; source and DOM checks alone
do not establish visual approval.

## Selection bubble menus

A nowrap toolbar owns a horizontal scrolling rail. A dropdown inside that rail is
clipped vertically as well. The selection bubble's More menu uses the Core document
portal so the popup escapes that clipping boundary. Core owns its viewport bounds,
scrolling and popup layer.

The editor adapter recognizes focus within a popup referenced by its trigger's
`aria-controls`. That relationship keeps the bubble valid while its portaled menu is
focused. Toolbar capture handlers leave nested menu keys to the menu; Escape closes
the menu and restores its trigger before an additional Escape can return to the
editor. Selected editor state remains available to the menu commands.
