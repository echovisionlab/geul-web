# Dialog actions

`DialogActions` owns the action-row layout for Core FormModal, ConfirmModal and
BlockingAlertDialog, and for composed ContentModal tasks. Concluding commands align
to the logical end: right in LTR and left in RTL. Buttons retain content widths;
the row wraps at narrow widths without turning the commands into full-width tiles.
The shared `action-group` spacing role owns their gap. No new token is introduced.

```tsx
<DialogActions>
  <Button emphasis="low" onClick={onCancel}>
    Cancel
  </Button>
  <Button emphasis="strong" onClick={onSave}>
    Save
  </Button>
</DialogActions>
```

Put secondary/cancel actions before the primary action in DOM order. File insertion
puts File library before Browse files when both are offered. The upload-only panel
keeps Browse files at the end. Labels, request state and callbacks remain owned by
the consumer; the row does not infer emphasis or reverse the reading order.

Use the optional `leadingActions` slot to separate a destructive or auxiliary
command from Cancel/Save, as in program-event type editing. Do not use it to put
the main command on the left. Input-plus-test rows, list pagination and per-item
commands remain separate compositions. Cookie consent keeps its own equal-choice
decision layout and does not acquire a primary/cancel hierarchy.

The public props are `children`, optional `leadingActions`, `id` and `dir`.
Alignment, gap, growth, wrapping and visual overrides are closed. The component
renders structural layout only; its buttons own names, focus, disabled state and
activation. It creates no extra tab stop or ARIA group. Modal focus containment,
dismissal and restoration still belong to OverlayDialog.

## Migration

Replace dialog footer `LayoutInline justify="end"` with `DialogActions`; remove
manual `gap`, `grow` and `wrap`. Wrap isolated concluding buttons in the same
component. Keep form submission and pending dismissal guards unchanged. Use
`leadingActions` for an existing deliberately separated destructive command.
Do not change generic LayoutInline's start-aligned default.

Actual consumers include editor file/video insertion, image cropping, map provider
selection, place creation, account dialogs, menu and legal dialogs, release relation
editors, translation provider settings and administrative edit forms. The file
library selection-status footer already has a distinct trailing action slot.

Core stories cover ordinary, phone, long-label and separated-destructive layouts.
The ordinary and phone play checks measure end alignment and content widths and
exercise keyboard order. Existing modal and consumer tests cover pending state,
submission, dismissal and file-selection behavior. Those checks do not establish
native assistive-technology acceptance or deployment.
