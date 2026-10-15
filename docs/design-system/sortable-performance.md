# Sortable rendering and performance review

`SortableGroups` keeps the sortable shell and domain editor content separate.
The shell still receives every live transform and transition from `useSortable`.
Unchanged group/item content is memoized with stable drag bindings and item collection nodes.
Changing data, renderer callbacks, drag state or drop-target state updates the relevant content.
Child editor state and context updates remain independent of this optimization.
Pointer and keyboard sensor options also keep a stable identity across parent renders.
The pointer activation distance remains eight pixels and the existing vertical keyboard
coordinate getter is unchanged. This avoids replacing unchanged Dnd Kit activators and
listener maps when a parent updates its own state.

The production Form Builder preview updates when its schema order changes. Its
`FormStep` requests focus only for explicit Next/Previous navigation from
`FormRenderer`, including Enter in a valid text input. A passive schema update does
not move focus from the builder grip into the preview. This keeps response-form
navigation focus and editor focus under their respective owners.

## Reproduction and source evidence

The controlled source-hook regression uses two groups and twenty item views.
Before the change, four transform-only updates called group renderers eight times and
item renderers eighty times. After the change, both counts are zero while the rendered
shell transform still updates. Starting a drag updates the active item; entering an empty
destination updates that destination group. Existing reorder, cancellation, announcement,
identifier and Form Builder behavior tests run separately.
The sensor regression uses the installed Dnd Kit hooks and verifies that an unchanged
parent render preserves both descriptors and their activation/keyboard options.

These counts measure the React content path with controlled hook snapshots in jsdom.
They do not measure browser frame rate, layout cost, pointer latency or assistive technology.
The optimization leaves activation distance, pointer/keyboard sensors, collision detection,
animation timing, focus restoration and announcement behavior intact.

## Review the actual examples

- `Core / Interaction / SortableGroups / Motion Rendering` renders real Core inputs and
  displays renderer counters when **Sample render counters** is pressed. Drag horizontally
  within the first row to inspect motion without changing the item order. The play test
  checks that motion does not repeatedly render unchanged field content.
- `Feature / Form / Builder / Large Form Reorder` uses the production `FormBuilder` with
  two steps and twenty-four text fields. The play test checks keyboard step reordering
  and the same connected handle's focus after Dnd Kit's deferred focus restoration.
  Expand steps/fields to inspect production editor responsiveness.
- Existing keyboard reorder and cancel examples continue to test semantic behavior.

Renderer counters record executions, including any extra development/Strict Mode renders.
Activation, drop-target changes and dropping can update active content even without an
order change. Sampling also updates the diagnostic fixture's parent state; compare samples
as a complete interaction, rather than treating their delta as transform-only work.
React Profiler duration and commit counts are meaningful only in a profiling-enabled build;
an ordinary production build may report zero profiling commits. Capture actual browser
timings with the build mode, device, viewport, item count and expansion state before making
a frame-rate or latency claim. Read the [React Profiler reference](https://react.dev/reference/react/Profiler).

## Consumer responsibilities and accessibility boundary

Keep renderer functions and unchanged source objects stable when practical. Source edits,
locale changes and changed callback behavior must still reach the visible editor; memoization
does not permit mutating item/group objects in place or ignoring a changed callback.

Drag and keyboard reorder currently exist in the reviewed Form Builder/SortableGroups path.
A single-pointer non-drag movement alternative remains a separate known gap. Keyboard
equivalence alone does not establish [WCAG 2.5.7](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html)
conformance. This rendering change does not add or remove movement commands.

## Single-list item wiring: `useSortableItem`

Feature lists that own their own `DndContext` (release tracks/credits/artists/labels, work
clients/credits, menu items, page sections, marquee items, validators, poster tiles) bind each
entry through `useSortableItem({ id, data?, disabled? })` from `@/components/core/Sortable`.
Features do not import `useSortable` or `CSS` from Dnd Kit for item wiring.

| Returned field | Consumer                                                                                                                                             |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setNodeRef`   | the moving Core surface (`SortableSurface` `ref` or `Table.Tr` `ref`)                                                                                |
| `motion`       | `SortableSurface` `motion`                                                                                                                           |
| `dragState`    | `Table.Tr` `dragState` (translate-only string; the sensor scale is never applied)                                                                    |
| `isDragging`   | domain state such as `SectionCard` `state="dragging"`                                                                                                |
| `handle`       | spread onto the leading `IconButton interaction="drag-handle"`: activator `ref`, Dnd Kit attributes and listeners, filtered by `interactionBindings` |

Spread `handle` before the handle's own `aria-label`. To add a description, merge
`handle['aria-describedby']` with the feature's id so Dnd Kit's instructions remain referenced.
Each returned object keeps its identity until its own inputs change, so memoized rows may
depend on `handle` without re-rendering for unrelated motion. The hook does not choose sensors,
collision detection or sorting strategy; those remain on the list's `DndContext`/`SortableContext`
with the same eight-pixel pointer activation. `Core / Interaction / ReorderRow / Sortable Item Hook`
shows the complete wiring.
