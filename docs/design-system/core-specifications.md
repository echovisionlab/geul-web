# Core component specifications

Updated: 2026-10-12. Status: source contracts documented; Storybook review in progress.

Follow the purpose, anatomy, API, geometry, states, content and accessibility order in the
[Carbon writing criteria](carbon-reference.md). Geul source owns colors, sizes, defaults and allowed enums.
This document records the current Core contracts and the checks to perform in actual Storybook examples.
Written specifications and passing automatic checks do not establish complete design or accessibility approval.

Detailed reviews dated 2026-10-12: [Button family](button-api-review.md), [Field](field-api-review.md),
[inputs](input-api-review.md), [choice inputs](choice-api-review.md),
[IconButton and TextButton](icon-text-button-api-review.md),
[navigation, overlays and pagination](navigation-overlay-pagination-api-review.md),
[Toolbar](toolbar-api-review.md), [DataTable](table-api-review.md) and [Dialog](dialog-api-review.md).

## Shared specifications

Sources: [design-tokens.ts](../../components/core/design-tokens.ts),
[Control.module.css](../../components/core/Control.module.css),
[Input.module.css](../../components/core/Input/Input.module.css),
[size and density contract](size-density-contract.md), [ownership contract](ownership-contract.md).

Pixel values below are conversions at the default 16px root size. The application consumes the original rem/em values and semantic tokens.

| Role                    | Token                                       | Default value                                                      |
| ----------------------- | ------------------------------------------- | ------------------------------------------------------------------ |
| Internal spacing        | `spacing-xxs/xs/sm/md/lg/xl`                | 4 / 8 / 10 / 12 / 16 / 24px                                        |
| Font size               | `font-size-xs/sm/md/lg/xl`                  | 12 / 14 / 16 / 18 / 20px (paper 8 / 9 / 10.5 / 11.5 / 12.5pt)      |
| Heading                 | `heading-title/h1/h2/h3`                    | 32 / 28 / 24 / 20px below `sm`; 40 / 34 / 26 / 22px from `sm`      |
| Paper heading           | `heading-title/h1/h2/h3` in `@media print`  | 22 / 18 / 15.5 / 13.5pt; h4–h6 follow lg / md / sm                 |
| Font weight             | `font-weight-regular/medium/strong`         | 400 / 500 / 600                                                    |
| Body line height        | `line-height-xs/sm/md/lg/xl`                | 1.4 / 1.45 / 1.55 / 1.6 / 1.65                                     |
| Control height          | `control-height-xs/sm/md/lg/xl`             | 30 / 36 / 42 / 50 / 60px                                           |
| Compact / chrome height | `control-height-compact/chrome`             | 28 / 32px                                                          |
| Coarse-pointer minimum  | `interaction-touch` → `interaction-minimum` | 44px; minimum is 0 for fine pointers                               |
| Boundary / focus        | `border-thin/focus`                         | 1 / 2px                                                            |
| Radius                  | `radius-square/circle`                      | 0 / 50%                                                            |
| Disabled opacity        | `opacity-disabled`                          | 0.5, limited to the parts that the relevant Core CSS applies it to |
| Icon                    | `chrome-icon-size`                          | 16px, independent of the interaction target                        |

Light/Dark changes values under the same semantic names: `text-primary`, `text-muted`, `surface`,
`border-default`, `focus`, `status-*` and `action-*`. Image and print roles such as `paper-*`,
`text-on-image` and `overlay-*` are separate. Locale-specific Noto and mono assignments live in
[font-assignment.css](../../lib/styles/font-assignment.css).

Core owns internal colors, boundaries, geometry and states. Features supply data, order, external layout and events.
Do not bypass the contract with `style`, `className` or framework `variant/color/size` props.
Use the closed [Control props](../../components/core/control-props.ts) and
[Input props](../../components/core/Input/input-contract.ts). `aria-*` supplies semantic relationships; it does not create another visual variant.

## Button

Sources: [Button.tsx](../../components/core/Button/Button.tsx), [Control CSS](../../components/core/Control.module.css),
[control-context.tsx](../../components/core/control-context.tsx), [stories](../../components/core/Button/Button.stories.tsx).

**Purpose and anatomy.** Commands render a button; navigation renders a link with `href`.
The root order is leftSection → label → rightSection → indicator. The loading spinner overlays the center.
Menu/disclosure indicators follow the label and rotate when expanded.

| API                       | Allowed values and defaults                                                                                                       |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `size`                    | compact, xs, sm, md, lg, xl; standalone default sm                                                                                |
| `tone` / `emphasis`       | neutral, accent, positive, warning, danger / strong, medium, low, outline; default neutral/medium                                 |
| `contrast`                | standard, inverse; inherits ControlContrastProvider                                                                               |
| `justify` / `fullWidth`   | start, center, between / boolean; default center and content width                                                                |
| `labelWrap` / `indicator` | nowrap or wrap / menu or disclosure on commands only                                                                              |
| Command / navigation      | Commands accept type button/submit/reset; links accept href/navigation props. Links cannot combine indicator, type or form props. |

| Size    | Height    | Text    | Inline padding                            |
| ------- | --------- | ------- | ----------------------------------------- |
| compact | 28px      | xs 12px | xxs 4px                                   |
| xs      | 30px      | xs 12px | sm 10px; xxs 4px in compact HeaderDensity |
| sm / md | 36 / 42px | sm 14px | md 12px                                   |
| lg / xl | 50 / 60px | md 16px | lg 16px                                   |

Internal gap is `spacing-role-control-label` 8px, or `spacing-role-control-label-compact` 4px in compact HeaderDensity.
`size="compact"` or compact ToolbarDensity alone retains the 8px gap. Inline padding consumes
`control-padding-compact/xs/standard/large`. Values and the [spacing/icon contract](spacing-icon-contract.md)
share the same source. Compact ToolbarDensity takes precedence over row size. Coarse-pointer height is at least 44px.

**States and combinations.** Medium/low defaults have no fill; outline has a boundary; strong uses the tone's action fill.
Medium/low hover uses `surface-hover`, and pressed uses `surface-active`.
Outline hover changes only the boundary to currentColor; pressed adds a surface.
Strong hover/pressed uses the corresponding `action-*-hover/pressed` roles.
Selected non-strong controls use `surface-muted` and tone ink. Focus preserves the existing boundary and adds a 2px outline with 2px offset.
Disabled uses `text-muted` ink, root opacity 0.5 and `surface-muted` for strong fill.
Pending blocks activation and shows label/section opacity 0.5 with a spinner. Reduced motion stops rotation.

**Content and layout.** Nowrap labels use single-line ellipsis. Wrap allows multiple lines and xs block padding.
Use fullWidth only when requested; otherwise use content width. Check long translations, icons and wrap+loading in the browser.

**Interaction, accessibility and usage.** Consume React Aria press/pending/disabled behavior and link navigation.
Preserve visible label text in the accessible name. Spinner naming follows loadingLabel, ARIA name or label relationships.
Ordinary commands use neutral/medium and supporting commands use low. Designated Dialog primary actions use strong;
final delete/discard/revoke confirmation uses danger/strong. A submit action name alone does not justify strong or full-width treatment outside that scope.

**Storybook review.** Check all named sizes and supported tone/emphasis combinations, hover/pressed/focus/disabled/pending,
inverse and sections/indicator. Compact size's 8px gap and compact HeaderDensity's 4px gap are separate conditions.
Combine fullWidth, wrap, justify, row size and Toolbar/Header density; review long translations and repeat-activation blocking in actual consumers.

## IconButton

Sources: [IconButton.tsx](../../components/core/IconButton/IconButton.tsx), [Control CSS](../../components/core/Control.module.css),
[stories](../../components/core/IconButton/IconButton.stories.tsx).

**Purpose and anatomy.** A named icon command, navigation control or drag handle.
Idle renders root → glyph → optional count. Pending removes the glyph/count, renders only a named spinner,
and restores the original content afterward. The label supplies an accessible name without being copied into visible text.
Distinguish the glyph from its interaction target.

**API and defaults.** tone=neutral, emphasis=low, shape=square, size=xs.
Size allows compact/chrome/xs/sm/md/lg/xl; shape allows square/circle. The former duplicate `controlSize` was removed; use `size`.
`interaction="drag-handle"` owns compact size and does not accept size.
A toggle passes `pressed`: Core sets `aria-pressed` and owns the neutral resting ink and the muted selected surface.
Toggles reject `tone`/`emphasis` and raw `aria-pressed`; links and drag handles are not toggles.
Count is a nonnegative safe integer; values of 100 or more display `99+`.
The naming union requires one of label, aria-label or aria-labelledby.
Placement allows inline and four overlay start/end positions.

**Geometry.** Width=height=`max(control-height, interaction-minimum)`, padding=0, glyph=16px.

**States.** Low defaults use `action-ink-muted`; hover/pressed/focus/disabled/pending follow Control.
Inverse image overlays use `text-on-image` and `overlay-control/strong`.
Drag handles own grabbing and touch-action and block dragging while disabled.

**Content, layout and accessibility.** Do not use a long name as visible content that expands an icon target.
Use Button when a visible label is needed. Place a drag handle first on the left and connect it to the actual sensor/activator.
The handle's Space/Enter passes to the reorder sensor without becoming ordinary press.
Verify icon-only naming, focus and count meaning in code and consumers.

**Storybook review.** Check named size, tone/emphasis, square/circle, count, inverse and overlay.
PendingWithBadge and PendingTransition must preserve name, focus and target while showing only the spinner,
then restore glyph/count. OpticalGlyphComparison measures SVG frame, path span, padding and target separately.
Review actual drag sensors and tooltip composition in consumers.

## TextInput

Sources: [TextInput.tsx](../../components/core/Input/TextInput.tsx), [InputParts.tsx](../../components/core/Input/InputParts.tsx),
[Input CSS](../../components/core/Input/Input.module.css), [stories](../../components/core/Input/TextInput.stories.tsx).

**Purpose and anatomy.** Single-line input: label → wrapper(leftSection, input, rightSection) → description → error.
Label and description are optional; an accessible name is required.

**API and defaults.** Default CSS corresponds to size=sm, density=comfortable, appearance=underline and textRole=body.
Allowed values are size=xs/sm/md/lg/xl, density=comfortable/compact, appearance=underline/bare,
and textRole=body/title/code/caption. Type allows text/email/tel/url/search/password/date/time/datetime-local.
Distinguish controlled value from defaultValue. Pass required/disabled/readOnly/error through InputBaseProps.
textRole=title stands in for a page title (EditorHeader): it has no inline padding, so its text starts where a
read-only title would, and at size=xl it uses the page title scale (Heading scale 2); smaller sizes use h3.

**Geometry.** Root gap=xxs 4px; input block padding=xxs 4px and inline padding=xs 8px.
Height and font size follow named control-height/font-size. sm line height is 1.45.
Compact density uses 28px height. Coarse pointer uses at least 44px height and md 16px text.
Description/error uses xs 12px/1.4.

**States.** Default/hover underline is `border-strong` 1px. Focus adds the `focus` underline and an inner 1px line.
Invalid uses danger underline; invalid+focus preserves the danger inner line and adds the focus outline.
Disabled uses muted ink and the default boundary without reducing root opacity.
ReadOnly blocks editing while preserving reading and text selection.
Bare hides the default underline while retaining focus and invalid indicators.

**Content and layout.** Input uses min-width=0, width=100%, flex=1.
Muted placeholder text does not replace a label. Long values scroll within the single-line input.
Title/code/caption follows the relevant Core typography rule.

**Interaction and accessibility.** Consume React Aria TextField label/description/error relationships with validationBehavior=aria.
Preserve IME composition, required, pattern and input events. Use Textarea for multiline input.

**Storybook review.** Check browser UI for each type, underline/bare, textRole, size/density, sections and label/help/error.
Review long values, disabled/readOnly, invalid+focus, merged external aria-describedby and actual IME composition/commit/cancel.
Keep DOM event regressions separate from actual input, font and layout verification.

## PasswordInput

Sources: [PasswordInput.tsx](../../components/core/Input/PasswordInput.tsx), [stories](../../components/core/Input/PasswordInput.stories.tsx).

**Purpose and anatomy.** Reuses TextInput value and boundary, with a trailing accessory to toggle visibility.

**API and defaults.** Excludes type/rightSection from TextInputProps and adds visible/defaultVisible/onVisibilityChange/visibilityToggleLabel.
Hidden by default. Visible is controlled; defaultVisible sets initial state.

**Geometry and states.** Follows TextInput geometry/states. The toggle uses the control-height-xs minimum target;
disabled also blocks the toggle. Visibility changes must preserve value and focus. Invalid+focus follows TextInput.

**Content and accessibility.** Use fictional password values; never store actual account secrets in fixtures or documentation.
Check long values and coarse pointers where the toggle reduces input space.
The toggle has aria-pressed and a name for its current action; default naming follows the locale input-label provider.

**Storybook review.** Check controlled/uncontrolled visibility, preserved value/focus and toggle names.
Review size/density, invalid+focus, disabled/readOnly, long values and coarse input/toggle targets.

## NumberInput

Sources: [NumberInput.tsx](../../components/core/Input/NumberInput.tsx), [stories](../../components/core/Input/NumberInput.stories.tsx).

**Purpose and anatomy.** Numeric input with adjustment: label → wrapper(prefix, input, suffix, decrement, increment) → help/error.

**API and defaults.** Value/defaultValue accepts number|string; onChange returns a number or empty string.
Supports min/max/step/decimalScale/allowNegative/allowDecimal/hideControls/prefix/suffix.
allowDecimal=false sets maximum decimal places to 0; otherwise the default maximum is 20.
allowNegative=false constrains the minimum to at least 0. Adjustment controls are visible by default.
InputBase owns size/density/state.

**Geometry and states.** Uses TextInput input geometry. Each accessory has a control-height-xs minimum target.
Distinguish default/focus/invalid/disabled/readOnly and adjustment availability at min/max.

**Content and accessibility.** Prefix/suffix are sections, not arbitrary additions to the numeric value string.
Check decimals, negatives, empty values, locale formatting and narrow widths with accessories.
Consume React Aria NumberField numeric input and adjustment. The installed vendor removes explicit spinbutton role for VoiceOver handling;
verify actual arrow-key boundaries and assistive technology numeric guidance separately.

**Storybook review.** Check min/max, step, empty values, decimals, negatives, prefix/suffix and shown/hidden controls.
Review readOnly, invalid+focus, adjustment availability, keyboard boundaries, locale and actual assistive technology guidance.

## Select

Sources: [Select.tsx](../../components/core/Input/Select.tsx), [Input CSS](../../components/core/Input/Input.module.css),
[stories](../../components/core/Input/Select.stories.tsx), [behavior tests](../../components/core/Input/InputBehavior.test.tsx).

**Purpose and anatomy.** Select one value: ComboBox label → wrapper(input, optional clear, open accessory) →
Popover(ListBox, optional group header and option) → help/error.

**API and defaults.** Width allows fill/content; the default flows as fill. Data allows strings, InputOptions or groups.
Supports searchable/clearable/allowDeselect, controlled selection/search/open state and renderOption. `clearLabel` names the clear command for its effect (for example "Remove post from series"); it defaults to the shared "Clear all" label.
Disabled/readOnly blocks updates and clearing. Non-searchable inputs are readOnly.

**Geometry and states.** Input size/density propagates to the popover.
Popover padding=xxs; option block padding=xxs, inline padding=xs, minimum height=control-height.
Hovered/focused options use surface-hover; selected uses surface-active/strong; disabled uses text-muted.
Popover boundary is border-default, with a maximum list height of input-height×8.

**Content and layout.** Content width measures all labels/placeholders and accessory geometry, constrained to max-width=100%.
Below xs breakpoint, content width also fills the available width.
Check non-searchable/no-results/group/long-option/clear+open combinations.

**Interaction and accessibility.** React Aria owns selected value, expanded and listbox/option relationships.
Supply a label or ARIA name. Verify search, arrows, Enter, Escape and focus restoration in actual code. Use MultiSelect for multiple values.

**Storybook review.** Check closed/open trigger/popover relationships, search/no results/groups, clearable, readOnly and disabled.
Review content/fill width, long options and coarse pointers. Confirm arrows, Enter, Escape and focus restoration through actual interaction.

## Checkbox

Sources: [Checkbox.tsx](../../components/core/Input/Checkbox.tsx), [Input CSS](../../components/core/Input/Input.module.css),
[stories](../../components/core/Input/Checkbox.stories.tsx).

**Purpose and anatomy.** Independent on/off or multiple selection. One React Aria control contains check and label,
followed by description/error. Do not add another clickable wrapper.

**API and defaults.** Supports checked/defaultChecked/indeterminate/value/onChange and InputBase props.
Group owns string[] value/defaultValue and its change callback. Default size=sm and unchecked.
Checkbox has no onLabel/offLabel; on/off text belongs to Switch.

**Geometry.** Check size=`chrome-icon-size` 16px in every density, matching Radio and the Switch track height; the indicator-to-label gap is `spacing-xs` 8px and the row is `control-height-compact` 28px (44px coarse).
Check-label gap=xxs 4px; overall minimum is 16px.
Coarse-pointer choices use at least 44px; unlabeled controls also have a 44px minimum width.

**States.** Checked/mixed shows the primary check/minus. Hover uses surface-hover; pressed uses surface-active.
ReadOnly/disabled blocks hover/pressed changes and value updates.
Invalid uses danger boundary; focus uses the outer focus treatment.
Disabled applies muted boundary/glyph and opacity=0.5 to the check, not the whole label.

**Content and accessibility.** Check wrapping and check alignment with long labels. Mixed has aria-checked=mixed.
Change events use the internal input's committed checked value. Connect description/error through aria-describedby.

**Storybook review.** Check off/on/mixed, size/density, unlabeled/long labels, Group, disabled/readOnly and invalid+focus.
Review Group names, external/internal description/error relationships, Space/label activation and state events.

## Radio

Sources: [Radio.tsx](../../components/core/Input/Radio.tsx), [stories](../../components/core/Input/Radio.stories.tsx).

**Purpose, anatomy and API.** Choose one value from a Group. Group accepts value/defaultValue/onChange and
horizontal/vertical orientation, default vertical. Default size=sm.

**Geometry and states.** Circle=spacing-lg 16px, border-thin 1px, label gap=xs 8px.
Selected uses text-primary, focus uses the outer focus treatment and disabled labels use muted ink.
Size changes label typography, not the 16px circle. Verify invalid boundary with actual Group/React Aria propagation.

**Content and accessibility.** Horizontal groups wrap. Check long labels, disabled items, no selection and reflow.
Provide a group name and one selected value; verify arrow movement/selection in RadioGroup.
ReadOnly is the Radio.Group contract inherited by children; individual Radio readOnly is not forwarded.

**Storybook review.** Check individual selection and Group horizontal/vertical, disabled/readOnly, no selection and long labels.
Review group name, one selected value, arrows, Space, invalid relationships and reading order after wrap.

## Switch

Sources: [Switch.tsx](../../components/core/Input/Switch.tsx), [stories](../../components/core/Input/Switch.stories.tsx).

**Purpose and anatomy.** Toggle a single setting. The RAC label root renders track(thumb) → optional on/offLabel (aria-hidden, outside the track) → label;
description/error follow the label root in a column wrapper with xxs 4px gap.
Consider Checkbox when choosing several values before submission.

**API and defaults.** Accepts checked/defaultChecked/value/onChange, readOnly/disabled and size/density.
OnLabel/offLabel renders from actual selected state, including defaultChecked and uncontrolled updates. Default off.
Switch has no indeterminate state; use Checkbox for mixed selection.

**Geometry and states.** Track width=control-height-compact 28px, height=chrome-icon-size 16px, padding=1px, border=thin 1px border-strong,
radius=half height. Thumb=16−(1+1)×2=12px; travel=`28−16=12px`. Every density uses the same track; the choice row is 28px (44px coarse).
RTL negates the travel. The choice row min-height is max(input size height, interaction-minimum).
Off uses surface-muted track/text-muted thumb; on uses text-primary track/text-on-action thumb.
Focus uses the outer focus treatment on the track. Disabled sets the row to text-muted with a not-allowed cursor and the
track to opacity-disabled 0.5; readOnly blocks changes without a separate visual state.
Invalid/required belongs to native input semantics; do not invent another danger track.

**Content and accessibility.** Choice gap=xs 8px. Check long labels and text inside the track.
Change events use the committed checked value; aria-invalid/required reaches the actual input.
Checked, naming, description/error and Space/label activation require runtime verification.

**Storybook review.** Check off/on, checked/defaultChecked, on/offLabel, disabled/readOnly and invalid/required.
Confirm uncontrolled track text follows actual state. Review long labels, RTL, coarse targets and name/description relationships.

## Field

Sources: [Field.tsx](../../components/core/Field/Field.tsx), [Field CSS](../../components/core/Field/Field.module.css),
[stories](../../components/core/Field/Field.stories.tsx).

**Purpose and anatomy.** Connects label, description, error and optional actions to an external control:
header(copy, actions) → control → relevant description/error. The child Core owns its own geometry/input state.

**API and defaults.** Label/children required. Layout=stack/inline, default stack; supports description/actions/error/required/htmlFor.

**Geometry.** Stack gap=`spacing-role-field-label` 4px, the same row gap as Core Input; the label row uses `font-size-sm`/`line-height-sm` like the Input label. Header gap=sm 10px.
Inline uses equal-width columns, column-gap=`spacing-role-field-column` 10px and row-gap=xxs.
Label=sm/medium; supporting/error text=xs/1.4; required/error uses danger.

**States.** Connect required to the child and decorative asterisk; pass errors to child aria-invalid/error.
Disabled is a child state, not a Field variant. The control owner decides invalid+focus appearance.

**Content and layout.** Stack description sits with label copy; inline description/error spans both columns.
Inline controls align to the end, with content width and max-width=100%.
Review long labels/actions/control-width combinations. Consumers choose whether their Layout switches to stack at narrow widths.

**Interaction and accessibility.** Preserve or generate the single child's ID. The label carries `<id>-label` and is
added to the child's aria-labelledby (merged with the child's own; skipped when the child has aria-label), because
React Aria fields do not observe a native `<label for>`.
Verify label activation, merged existing/new description/error IDs and contenteditable focus delegation in code.

**Storybook review.** Check stack/inline with native inputs, contenteditable adapters, actions and long labels.
Review equal columns, content width, max-width, full-row description/error and label activation in the actual browser.
Do not assume Field's HTML label alone names a grouped child.

## Tabs

Sources: [Tabs.tsx](../../components/core/Tabs/Tabs.tsx), [Tabs CSS](../../components/core/Tabs/Tabs.module.css),
[stories](../../components/core/Tabs/Tabs.stories.tsx), [tests](../../components/core/Tabs/Tabs.test.tsx).

**Purpose and anatomy.** Switch panels in the same context: Tabs → List → Tab(leftSection, label, rightSection), Panel.
Distinguish this from page navigation links.

**API and defaults.** tone=neutral; appearance=line/outline/pills, default line; orientation=horizontal/vertical, default horizontal;
activation=automatic/manual, default automatic; keepMounted=true; fill=false.
Supports value/defaultValue/onChange and root/tab disabled.
List accepts grow/wrap/inset/paddingTop; Panel accepts inset/paddingTop.

**Geometry and states.** Minimum tab height=chrome-row-height 32px; block padding=xxs, inline padding=xs; gap=xxs;
text=chrome-font-size 12px/medium/line-height-xs.
Line selection uses a 1px currentColor boundary, on the right for vertical orientation.
Outline selection uses the default boundary and background bottom; pills uses action fill/on-action.
Hover uses primary ink; disabled uses muted ink/opacity=0.5; focus uses an offset outline.
Selected+focus preserves the selection boundary.

**Content and layout.** List wraps by default; specify nowrap explicitly. Grow distributes equal flex space.
Current CSS has no tab-label ellipsis rule; do not document automatic truncation.

**Interaction and accessibility.** React Aria owns tab/panel relationships and roving focus.
Distinguish automatic/manual activation and disabled-item skipping.
ExternalPanel connects explicit tabId/id and aria-controls.
KeepMounted preserves state while excluding inactive panels from reading and keyboard navigation.

**Storybook review.** Check line/outline/pills, tone, orientation, activation, disabled and selected+focus.
Review List names, panel/externalPanel relationships, grow/wrap/inset, keepMounted, arrows and focus movement.

## SideNavigation

Sources: [SideNavigation.tsx](../../components/core/SideNavigation/SideNavigation.tsx),
[CSS](../../components/core/SideNavigation/SideNavigation.module.css), [stories](../../components/core/SideNavigation/SideNavigation.stories.tsx).

**Purpose and anatomy.** Provides page links within sections. Expanded labeled sections are Core Disclosure
(appearance=plain, density=chrome, contentIndent=none, no divider) holding the items; unlabeled sections are items only.
Compact labeled sections use a menu trigger and DropdownMenu; unlabeled sections use individual links.

**API and defaults.** ariaLabel/sections/mode/openSectionKeys/onToggleSection/onSelectItem are required.
Mode=expanded/compact; showExpandedIcons=true. Items have key/href/label/icon and optional active/prefetch.
There is no item disabled prop. The component does not choose mode automatically from viewport width.

**Geometry and states.** Expanded items use chrome-row-height 32px, icon=16px, gap=xs 8px; item icons (or labels without icons) start on the section label's xs 8px edge, the 2px active boundary inside that inset; without icons, section children step in by one hierarchy step;
chrome text 12px/medium. Compact items are 40px square or at least 44px for touch.
Group headings follow the Disclosure nested-list spec shared by the form editor and the public mobile drawer:
28px, sentence-case 12px primary label, trailing chevron that turns over when open, hover fill, no rules between
expanded groups (the compact rail keeps rules). The label starts on the same xs 8px edge as the items.
Hover uses surface-hover/primary; active is unfilled primary/strong with a leading 2px focus boundary.
Focus uses an inner outline. Active+hover preserves the leading selection indicator.

**Content and layout.** Item labels use single-line ellipsis. Hiding expanded icons removes their track.
Hierarchy tokens align the reading start under section labels. Compact hides item labels and supplies tooltip/menu guidance.

**Interaction and accessibility.** Provide nav/section names, aria-current=page and section aria-expanded/controls.
The consumer controls section expansion. Prefetch=false disables hover/focus prefetch.
Verify compact menu and section-toggle keyboard behavior and focus restoration in code.

**Storybook review.** Check expanded/compact, group headings, labeled compact menus, icon presence and long labels.
Review active+focus/hover, hierarchy, aria-current, expanded/controls, menu restoration and modifier navigation in consumers.

## LabelBadge / StatusBadge

Sources: [LabelBadge.tsx](../../components/core/Badge/LabelBadge.tsx), [StatusBadge.tsx](../../components/core/Badge/StatusBadge.tsx),
[Badge CSS](../../components/core/Badge/Badge.module.css), [stories](../../components/core/Badge/LabelBadge.stories.tsx).

**Purpose and anatomy.** Displays a short category/status: dot or leftSection → label → rightSection → optional dismiss.
StatusBadge aliases LabelBadge. Do not use Badge itself as an ordinary command button.

**API and defaults.** tone=neutral; appearance=soft/outline/solid/dot, default soft; size=sm/md/lg/xl, default sm;
placement=inline/overlay-start, default inline. Dismiss requires dismissLabel.

**Geometry and states.** Inline padding=xxs 4px, gap=xxs, border-thin.
Named sizes use 12/14/16/18px text with xs 1.4 line height.
Neutral uses secondary ink; other tones use status ink. Soft/outline uses the default boundary.
Solid uses action-primary/on-action for every tone; do not invent tone-specific solid fills. Dot is a 4px circle.
Dismiss is a Core IconButton size=compact (28px, coarse pointer ≥ interaction-minimum 44px) with the X glyph;
its hover/focus/disabled states come from IconButton. dismissDisabled blocks only that action.

**Content and accessibility.** Label is nowrap, max-width=100%; do not assume long content is automatically truncated.
Preserve status meaning in text, not only color. Name dismiss separately from the label.
Overlay-start uses top/left xs and the surface background.

**Storybook review.** Check tone, appearance, size, sections, dismiss/disabled, overlay placement and long labels.
Separate textual status from color; review dismiss name, keyboard and consumer focus policy after removal.

## Alert

Sources: [Alert.tsx](../../components/core/Alert/Alert.tsx), [Alert CSS](../../components/core/Alert/Alert.module.css),
[stories](../../components/core/Alert/Alert.stories.tsx).

**Purpose and anatomy.** Supplies current state and guidance for the next action:
optional icon → content(title, description) → optional close.
Distinguish short Badge categories and blocking Dialog decisions.

**API and defaults.** tone=neutral; prominence=standard/strong, default standard; density=standard/compact, default standard;
role=alert. Accepts title/icon/children/onClose. withCloseButton=true requires closeButtonLabel.

**Geometry and states.** Gap=sm 10px; padding=md 12px or compact xs 8px; border-thin/default; surface background.
Title/icon uses tone ink; body uses primary. Strong prominence uses tone ink boundary without adding another fill.
Title=sm/strong; body=sm/1.45; title-description gap=xxs.
Close is a Core IconButton size=xs (30px, coarse pointer ≥ interaction-minimum 44px) with the X glyph; states come from IconButton.

**Content and accessibility.** Content uses flex=1/min-width=0; description uses overflow-wrap=anywhere.
Check long descriptions and optional title/icon/close at narrow widths.
Choose role/live announcements according to actual static or dynamic usage.
Close has a name; the consumer owns focus/announcement behavior after removal.

**Storybook review.** Check tone, density, prominence, optional parts, long strings and narrow parents.
Review close states, focus after removal and actual live announcements in context.

## Dialog: OverlayDialog / ConfirmModal / FormModal

Sources: [OverlayDialog.tsx](../../components/core/Modal/OverlayDialog.tsx), [ConfirmModal.tsx](../../components/core/Modal/ConfirmModal.tsx),
[FormModal.tsx](../../components/core/Modal/FormModal.tsx), [Overlay CSS](../../components/core/Overlay.module.css).

**Purpose and anatomy.** OverlayDialog: backdrop → panel → dialog(header(title, optional close), body).
ConfirmModal adds a message/action row; FormModal adds a form/action row.

**API and defaults.** OverlayDialog requires opened/onClose/title/children.
Defaults: size=standard, density=compact, bodyLayout=scroll, centered=false, dismissible=true, busy=false, role=dialog.
Size allows compact/standard/large/wide/workspace/auto; density allows standard/compact;
bodyLayout allows scroll/fit; placement allows left/right/bottom.
Alertdialog, descriptionId, mobileOnly and level have separate semantic purposes.
ConfirmModal defaults confirmTone=neutral/confirmEmphasis=strong; FormModal defaults submitTone=accent/strong.
Both cancellation actions use neutral/low.

**Geometry.** Compact/standard/large/wide panel widths are 384/448/640/960px, max-width=100%.
Header/body padding=md 12px or compact xs 8px; header gap=sm; divider=1px.
Title=md 16px/medium/1.55 or compact sm 14px/1.45.
Backdrop inset defaults to xl 24px, using sm 10px below the sm breakpoint and the larger safe-area requirement.
Panel height is limited by viewport and inset.

**States.** Loading connects busy and execution restrictions. ConfirmModal loading blocks dismissal, cancellation and confirmation;
confirmDisabled alone blocks only confirmation. FormModal loading blocks duplicate submission and closing.
Final destructive confirmation uses shared confirmation danger/strong.

**Content and layout.** Body owns scrolling. Workspace/fit/placement has a separate layout contract; do not simply scale the whole modal down.
Check long title/message/action labels, low viewport height, 200% text, keyboard and safe-area conditions.

**Interaction and accessibility.** Consume React Aria portal, focus scope/restoration, scroll lock and Escape/outside-dismiss policies.
Check aria-modal, title relationships, descriptionId, busy and dialog/alertdialog in the actual DOM.
Do not add a close button without closeLabel. OnClose follows the cancellation policy presented to the user.

**Storybook review.** Check size/density, placement/workspace, bodyLayout, long content/actions and low viewport height.
Review pending/disabled, real Promise waiting, form submission, duplicate blocking, dismissal and initial/trapped/restored focus.
Connect the designated primary-strong scope and domain confirmation intent to the relevant consumer documentation.

## ToolbarLayout / ToolbarSurface

Sources: [ToolbarLayout.tsx](../../components/core/Section/ToolbarLayout.tsx), [Layout CSS](../../components/core/Section/ToolbarLayout.module.css),
[ToolbarSurface.tsx](../../components/core/Section/ToolbarSurface.tsx), [Surface CSS](../../components/core/Section/ToolbarSurface.module.css),
[keyboard tests](../../components/core/Section/ToolbarSurface.test.tsx).

**Purpose and anatomy.** ToolbarLayout provides container-responsive search/filter/action composition.
ToolbarSurface provides role=toolbar and keyboard movement among related commands. They have separate public contracts.

| API            | Defaults and allowed values                                                                                                                                                                                                      |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ToolbarLayout  | arrangement=flow/actions-end/actions-inline, default flow; density=compact/comfortable, default compact; justify=between/start/end/center, default between; inset=none/content, default none; divider=none/surface, default none |
| ToolbarSurface | label required; wrap=nowrap/wrap, default wrap; density=comfortable/compact, default comfortable; width=content/full, default content; appearance=floating/embedded/inline, default floating                                     |

**Geometry and states.** Layout gap=`spacing-role-action-group` 8px, minimum height compact 28px/comfortable 36px.
Inset=content uses xxs block/md inline padding.
Surface defaults to xxs padding, `spacing-role-toolbar-item` 4px gap, surface background, default boundary and shadow-floating.
Compact padding/gap=0. Embedded retains only a bottom divider; inline removes boundary, shadow, padding and background.
Each child Core owns its internal command states.

**Content and layout.** Layout's lg/sm/xs container boundaries reflow leading/search/filter/action columns and order.
Surface wraps by default; nowrap scrolls horizontally.
Compact density sets Button/IconButton to compact and TextInput/Select to xs+compact.
Use drag handles only in the leading slot of an actual reorder context.

**Interaction and accessibility.** Layout retains ordinary Tab order.
Surface moves focus using ArrowLeft/Right/Home/End and excludes disabled/hidden/inert items and nested toolbars.
It preserves input/textarea/select arrows and reverses horizontal movement in RTL.

**Storybook review.** Check Layout arrangement/container transitions, leading/search/filters/actions and inset/divider separately
from Surface appearance/width/wrap. Distinguish Layout Tab order from Surface Arrow/Home/End, RTL and excluded items.
Review long search/filter content, coarse targets, nested toolbars, input arrows and overflow in actual compositions.

## Documentation, examples and verification boundaries

Core source and closed types define the public API. Storybook state examples are fixtures that exercise parts of that contract,
not new consumer APIs. Do not calculate complete support or verification from example counts.

| Review target                                   | Basis                                         | Required completion evidence                                                                  |
| ----------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Defaults, enums and CSS states                  | Core source and types above                   | Reconcile documentation, Controls and state examples after source changes                     |
| Tokens, theme and geometry                      | Owned tokens, Core CSS and shared provider    | Light/Dark on the same component, actual computed geometry and contrast review                |
| Long labels, reflow and combined states         | Related Core story and actual consumer View   | Browser width/content changes, wrapping, clipping and overflow                                |
| DOM names, relationships, keyboard and recovery | Core tests and story play                     | Executed regressions and browser interaction; actual assistive technology recorded separately |
| Mobile, tablet and desktop                      | Named responsive contracts                    | 320px and relevant breakpoint boundaries, fine/coarse, locales, RTL and low heights           |
| Consumer adoption                               | [Generated inventory](generated-inventory.md) | Owner change → actual consumer → accepted/rejected types → related Storybook review           |

Storybook previews and actual routes differ in authentication, server, shell and external-service scope.
Check those boundaries against [page coverage](page-preview-coverage.md) and the actual routes.
Assign gaps to the Core or consumer owner. Do not fill missing states with arbitrary Feature CSS or describe a subset of examples
as the complete contract. Record provider/hook behavior under its code contract.
