# Size and density contract

Geul shares control sizes, density and responsive behavior through Core. Screens
compose the same owners for spacing, interaction targets and recurring arrangements.

## Design rules

Keep the existing 4, 8, 10, 12, 16 and 24px spacing scale. Share an owner when the
meaning is the same; a different value alone does not justify a token or variant.
Align headings, labels, values and actions before adjusting density. Preserve needed
labels and focus, selected, error, loading and disabled feedback.

This product interpretation draws on Rams's restraint and attention to detail and
norns's repeatable interaction vocabulary. References: [Rams's principles](https://www.vitsoe.com/us/about/good-design),
[norns manual](https://monome.org/docs/norns/play/).

Screens compose Field, SectionHeader, Toolbar, SelectionRow and shared Features,
then supply data, order and events. Extend the shared owner when a recurring role is
missing. Map, media and authored-content geometry belongs to its domain and does
not authorize independently styled product controls.

## Size and input mode

| Role                        | Fine pointer at the default root size    | Coarse pointer     |
| --------------------------- | ---------------------------------------- | ------------------ |
| Standard controls           | xs, sm, md, lg, xl: 30, 36, 42, 50, 60px | At least 44px      |
| Compact commands and inputs | 28px                                     | At least 44px      |
| Chrome icon commands        | 32px                                     | At least 44px      |
| Menu rows                   | At least 26px                            | At least 44px      |
| Body links                  | Natural content line height              | Content typography |

Authority: `controlHeight` and `interaction` in `@echovisionlab/design-system/tokens`.
Button, IconButton and chrome TextButton in the same action row consume
ActionRowSizeProvider. A compact Toolbar's density takes precedence over row size;
independent controls use their named size. Font size, visible height and interaction
target remain separate roles. Arbitrary size, style and className overrides are
closed to consumers.

`any-pointer: coarse` also covers hybrid devices. Larger interaction targets occupy
real layout space; overlapping transparent hit areas are not used. Text inputs use
at least 16px type. ToolbarSurface wraps by default and provides horizontal scrolling
for explicit nowrap. Touch commands retain labels. ReorderGutter reserves the
editor's leading track for touch interaction.

Reorder grips keep their existing 28px fine / 44px coarse targets in the leading track.
Hover and pickup strengthen the glyph ink instead of painting the full target as a square.
The target remains present and stable before hover; rows do not gain padding or move on interaction.
Do not place the grip over a neighboring item or make a transparent target overlap another control.

Date and time fields are compound editable sequences. Numeric segments retain a minimum 28px
width and grow for their text; coarse input keeps 44px segment height. Field accessories keep
their 44px coarse targets. DateRange sequences use intrinsic width rather than distributing
empty space between the start, separator and end. Focus underlines the segment text in the
theme focus color; it does not paint the entire segment target. These exact dimensions and
presentation are product choices, not prescribed Adobe/W3C measurements.

Review `Core / Input / Input States / Intrinsic Date Range` and `Core / Interaction /
SortableGroups / Grip Hover Geometry`. These geometry checks do not prove complete drag
accessibility. A keyboard reorder route does not by itself satisfy the separate single-pointer
non-drag alternative in [WCAG 2.5.7](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html).
The current Archive, Page section/column and Form Builder consumers still require that
alternative to be connected to their existing reorder commands.

44px is the product's touch target. WCAG 2.2 AA SC 2.5.8 requires 24×24 CSS px or
one of its stated exceptions; 44×44 is the AAA enhanced target. References:
[minimum target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html),
[enhanced target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html).

## Responsive behavior and shared compositions

CSS media and container conditions consume generated `$mantine-breakpoint-*`
variables. JavaScript and image sizes use `breakpointQuery(name, 'below' | 'at-least')`.
Below means `<`; at-least means `>=`, so the exact boundary has one owner.
LayoutContainer's compact, standard and wide content widths are separate roles of
48, 62 and 75rem. A responsive transition does not automatically change content width.

UploadPlaceholder containers, MapLibre callout scale and Mermaid figure conditions
have specific owner/query exceptions. These do not permit arbitrary numeric
breakpoints in new screens.

- CompactTiptapEditor owns the square biography/description frame, minimum writing
  area and readOnly state. Artist, Label and Release supply collaboration bindings
  and data. Read-only content remains selectable and copyable.
- Label and Post participant rows share ParticipantRow. Each domain owns permission
  and mutation behavior.
- Core Select `width="content"` calculates label/accessory width and constrains it
  to available space. Narrow layouts use full width. Features do not duplicate its CSS.
- Overlays account for viewport height and safe areas. Review content scrolling and
  primary-action access together on narrow and short viewports.

## Enforcement and review

CI and ESLint invoke the same responsive ownership policy. It rejects numeric shared
breakpoints and private control geometry redefined outside its owner. The nine
strict Layout consumers are listed in [layout policy](layout-ownership-policy.md).
The token baseline is empty and must not be expanded to admit new violations.

`Composition/SizeDensity` composes actual Core controls and participant rows.
`Feature/Editor/CompactFrame` renders the collaboration-connected editor. Both
consume Storybook's global theme and locale providers. Review 320, 390, 768 and
1280px, breakpoint boundaries, light/dark, Korean, long labels, RTL and fine/coarse
input. Check overflow, clipping, targets, row changes and focus, selected, error and
pending states.

The previous size/density verification record reports Core, app and Storybook types,
changed-file ESLint/stylelint, 164 Vitest tests in 20 files (129 component regressions
and 35 import-boundary checks), 101 policy checks and 18 browser cases. Its browser
scope includes 320, 390, 767, 768, 769 and 1280px; fine/coarse input; light/dark;
Korean, German and Arabic RTL; menus, focus, editing, read-only selection and handle
menus. It also includes 200% root text size and a 360px-high viewport. This historical
record is not a fresh result for later source changes. Physical-device keyboard and
safe-area behavior require separate checks.

With the static Storybook running, repeat the suite with
`node scripts/design-system/verify-size-density-browser.mjs`. The first argument can
select an installed Playwright module and the second the preview URL. Results and
screenshots are written to `.artifacts/design-system/size-density`. The suite covers
shared compositions and the actual Block-room controller/NodeView. It does not
establish full media-playground execution or physical-device keyboard behavior.
