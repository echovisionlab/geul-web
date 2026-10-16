# Spacing and icon contract

Authority: [design-tokens.ts](../../components/core/design-tokens.ts). Dimensions
below assume a 16px root. Carbon's [Button specification](https://www.carbondesignsystem.com/building-blocks/core/components/button/specifications)
provides an 8px ghost label–icon comparison. Its larger filled-button spacing is not
applied to every Geul command.

| Role                  | Value             | Owner                                                                     |
| --------------------- | ----------------- | ------------------------------------------------------------------------- |
| control-label         | 8px → spacing-xs  | Label, icon and indicator inside a control                                |
| control-label-compact | 4px → spacing-xxs | Control under compact HeaderDensity                                       |
| action-group          | 8px → spacing-xs  | ToolbarLayout, SectionHeader, table command groups and outer media groups |
| toolbar-item          | 4px → spacing-xxs | Comfortable ToolbarSurface and media command clusters                     |
| field-label           | 4px → spacing-xxs | Stacked label → control → help rows in Core Field and every Core Input    |
| field-column          | 10px → spacing-sm | Two columns in an inline Field                                            |
| section               | 24px → spacing-xl | Independent sections in an outer composition                              |

`spacingRole` aliases foundations rather than copying values. `derivedTokenRoles`
checks the same projection in TypeScript and CSS. Layout `gap="action-group"` and
`gap="section"` expose outer relationships. `control-label` is not a Layout option;
Features cannot alter control internals. Existing `xxs/xs/sm/md/lg/xl` values remain
4/8/10/12/16/24px and do not scale automatically with viewport width.

`control-label-compact` applies under `HeaderDensityProvider density="compact"`.
Button `size="compact"` and compact ToolbarDensity retain the default 8px
`control-label` gap. Inspect the 8px compact Button gap and 4px compact HeaderDensity
gap separately in Storybook.

Core `controlPadding` aliases own inline padding: compact 4px, xs 10px, standard
12px and large 16px. IconButton padding is 0. Compact/inline ToolbarSurface's zero
gap and inset are explicit density exceptions. Field description/error rows span
both columns.

Table command groups consume `action-group` and wrap when their toolbar narrows.
They previously chose `xxs` independently; the shared external command relationship
now resolves to 8px at a 16px root. Compact media command clusters keep 4px through
`toolbar-item`, while the media clock's content separators retain `xxs`. This keeps
command relationships explicit without changing every 4px gap into a toolbar role.
The [token migration record](token-contract.md#2026-10-12-consolidation-and-migration)
explains the removed unused media roles and the contracts kept separate.

## Composition relationships

Reviewed 2026-10-13 with `node scripts/design-system/spacing-audit.mjs static|measure`
(results in `.artifacts/design-system/reviews/spacing-audit/`). One module, one value per
relationship. Text gaps are measured between line boxes; an inline label's glyph box
reads about 1px larger than its line box.

| Relationship                             | Value       | Owner / how to express it                                           |
| ---------------------------------------- | ----------- | ------------------------------------------------------------------- |
| label → control → help/error             | 4px         | `field-label`; Core Field and Input. Features do not rebuild it     |
| label → description (above the control)  | 0           | One text block inside Field's header                                |
| field → field                            | 12px (`md`) | LayoutStack/LayoutGrid default `md`                                 |
| SectionHeader → its content              | 12px (`md`) | LayoutStack `gap="md"`                                              |
| subsection → subsection inside one card  | 16px (`lg`) | LayoutStack `gap="lg"`                                              |
| section → section                        | 24px        | `section` (`xl`)                                                    |
| dialog body → DialogActions              | 12px (`md`) | Confirm/Form/BlockingAlert dialogs; body copy carries no own margin |
| public detail title → PublicMetadataRows | 16px        | Parent `gap="xs"` + the rows' own 8px block-start margin            |
| commands in a group / toolbar items      | 8px / 4px   | `action-group` / `toolbar-item`                                     |

Changes from this review:

- `field-label` moved from 8px to 4px. Core Input already used 4px between label, control and
  help; Core Field used 8px plus a 24.8px label line box (inherited 16px/1.55), so Field labels
  sat about 7px further from their controls than Input labels in the same form. With 12px
  between fields, a 4px label gap keeps every label closer to its own control than to the
  previous field's line. Field's label row now uses `font-size-sm`/`line-height-sm`.
- ConfirmModal rendered its message in a bare `<p>`, adding the 16px UA margin above and
  below (body → actions measured 28px against FormModal's 12px). It now uses Core `Text`.
- SectionHeader → content used `sm` (10px) in account settings and admin sign-in sections and
  `xxs` (4px) in the Page/Post editor Options block, against `md` (12px) everywhere else.
- Public detail title → metadata measured 20px (artist, label), 18px (release) and 16px
  (work, event); all five now resolve to 16px.
- Site asset uploads rebuilt a field with insets (label → description 4px, description →
  dropzone 8px); they now follow Field's label/description block and 4px control gap.
- `inset` literals in Tiptap node error overlays, the MapLibre attribution offset and the
  OG preview loading badge use spacing tokens. SelectionSurface derives its 26px action offset
  from the selection mark size plus `xxs`.

Enforcement: the token scanner (CLI and ESLint `design-tokens` rule) now treats `inset`
and `inset-*` like padding/margin, and rejects literal numbers or dimensions in JSX
`style={{ gap | padding* | margin* | inset* }}`. `em` offsets on positioned text markers
follow glyph metrics and stay allowed. The only geometry exception is the immersive scene's
viewport-scaled presentation (`authoredGeometryFiles` in `token-policy.mjs`). Physical
`top/left/right/bottom` hairline geometry (table resize handles, editor page decorations)
is not part of the spacing scale and remains a review item.

## Glyph and interaction target

Core displays Tabler's original 24×24 viewBox in a 16×16 glyph box. Preserve source
paths, proportions and optical centers; a glyph need not fill the entire box.
Exclude Tabler's empty background path when measuring drawn geometry. Measure the
SVG frame, visible paths, CSS padding, control box and parent gap separately. Visual
clearance alone does not justify cropping paths.

The named size or row density determines IconButton's fine-pointer target: compact
drag 28px, ordinary xs 30px and chrome 32px. Coarse-pointer targets occupy at least
44px of real layout space without scaling glyphs or overlapping transparent targets.
A Button's label–icon gap is separate from an IconButton's target clearance.
[IBM icon usage](https://www.ibm.com/design/language/iconography/ui-icons/usage/)
also distinguishes live area from touch clearance.

The shared roles and owners define the spacing contract. Enlarge or optically adjust
a glyph only with measurements and actual consumer evidence at the common owner.
Record Storybook wrapper spacing separately from product padding/gaps, together
with the actual CSS viewport and control box.

## Original glyph live-area comparison

Reviewed 2026-10-12. Geul Core uses installed `@tabler/icons-react` **3.49.0**.
Actual consumers include [IconButton](../../components/core/IconButton/IconButton.stories.tsx)
OpticalGlyphComparison and [MediaTransport](../../components/core/MediaControls/MediaTransport.tsx).
The installed outline defaults are viewBox 24×24, fill none, stroke width 2 and round
line caps/joins. The following values are **source calculations** at a 16×16 CSS px
display size, not browser-painted bounds, CSS stroke measurements or raster ink area.

| Action       | Tabler path bbox at 16px                        | Calculated stroke envelope | Carbon filled-path bbox at 16px                                                           |
| ------------ | ----------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------- |
| close        | IconX: x/y 6..18 → 8×8px                        | 9.33×9.33px                | Close16: viewBox32, x/y 8..24 → **8×8px**                                                 |
| menu         | IconMenu2: x4..20, y6..18 → 10.67×8px           | 12×9.33px                  | Menu16: viewBox16, x2..14, y3..13 → **12×10px**; four lines, versus Tabler's three        |
| plus         | IconPlus: x/y 5..19 → 9.33×9.33px               | 10.67×10.67px              | Add16: viewBox32, x/y 8..24 → **8×8px**                                                   |
| chevron down | IconChevronDown: x6..18, y9..15 → 8×4px         | 9.33×5.33px                | ChevronDown16: viewBox16, x3..13, y5.3..11 → **10×5.7px**                                 |
| grip         | IconGripVertical: x8..16, y4..20 → 5.33×10.67px | 6.67×12px                  | Draggable16: viewBox32, x10..22, y6..26 → **6×10px**; Tabler uses circles, Carbon squares |
| search       | IconSearch: x/y 3..21 → 12×12px                 | 13.33×13.33px              | Search16 uses a curved filled path; exact painted bounds still require path measurement   |

The Tabler envelope assumes original stroke width 2 and round caps/joins. For close,
adding stroke 2 to the 12-unit axis span gives `14 × 16/24 = 9.33px`. Different computed
stroke, transforms or vector-effect invalidate that assumption. Bounding-box
occupancy measures rectangular live-area extent, not ink area or visual weight.

In a 16px box, Tabler close's path occupies 50% of each axis; the calculated stroke
envelope occupies 58.3%. Carbon's default Close16 also occupies 50%. The sources do
not establish a rule that Carbon's ordinary close fills 12px. CloseLarge16 is a
different 10×10px glyph; CloseFilled16 includes a 14×14px circular background. A
background-inclusive glyph is not a scaling reference for an ordinary X. Menu width
is 12px in both the Tabler stroke calculation and Carbon, while line count, height
and stroke differ. Tabler plus is larger than Carbon Add under these assumptions.
Uniform cropping/scaling changes these differences and source centers and requires
consumer-specific evidence.

### Versions and official sources

The reviewed Carbon distribution is `@carbon/icons` **11.90.0**. Close16, Add16 and
Draggable16 have 16px width/height while retaining **viewBox 0 0 32 32**. Do not infer
a separate same-named source SVG in a 16px directory. Menu16, ChevronDown16 and
Search16 have their own viewBox16 sources.

- Tabler official distribution **3.49.0**: [default attributes](https://unpkg.com/@tabler/icons-react@3.49.0/dist/esm/defaultAttributes.mjs),
  [stroke default](https://unpkg.com/@tabler/icons-react@3.49.0/dist/esm/createReactComponent.mjs),
  [IconX](https://unpkg.com/@tabler/icons-react@3.49.0/dist/esm/icons/IconX.mjs),
  [IconMenu2](https://unpkg.com/@tabler/icons-react@3.49.0/dist/esm/icons/IconMenu2.mjs),
  [IconPlus](https://unpkg.com/@tabler/icons-react@3.49.0/dist/esm/icons/IconPlus.mjs).
- official distribution: [Close16](https://unpkg.com/@carbon/icons@11.90.0/es/close/16.js),
  [Add16](https://unpkg.com/@carbon/icons@11.90.0/es/add/16.js),
  [Menu16](https://unpkg.com/@carbon/icons@11.90.0/es/menu/16.js),
  [ChevronDown16](https://unpkg.com/@carbon/icons@11.90.0/es/chevron--down/16.js),
  [Draggable16](https://unpkg.com/@carbon/icons@11.90.0/es/draggable/16.js),
  [Search16](https://unpkg.com/@carbon/icons@11.90.0/es/search/16.js).
- official repository source, commit `47ab67155b185d56bf147b33cd9536e479ab0203`:
  [Close32](https://github.com/carbon-design-system/carbon/blob/47ab67155b185d56bf147b33cd9536e479ab0203/packages/icons/src/svg/32/close.svg),
  [Add32](https://github.com/carbon-design-system/carbon/blob/47ab67155b185d56bf147b33cd9536e479ab0203/packages/icons/src/svg/32/add.svg),
  [Menu16](https://github.com/carbon-design-system/carbon/blob/47ab67155b185d56bf147b33cd9536e479ab0203/packages/icons/src/svg/16/menu.svg).
- distinct glyph: [CloseLarge16](https://unpkg.com/@carbon/icons@11.90.0/es/close--large/16.js),
  [CloseFilled16](https://unpkg.com/@carbon/icons@11.90.0/svg/16/close--filled.svg).

### Remaining browser measurements

For close/menu/plus, record the SVG frame, visible paths, button target, CSS padding
and parent gap in the same consumer view. The current read-only measurement scope
uses SVG/path `getBoundingClientRect()` alongside viewBox, display size, computed
stroke/cap and transform. A path rectangle is not assumed to include painted stroke.
Exclude transparent background/artboard rectangles. `getBBox()` was not available
in that read-only scope and is not recorded as executed evidence.

For example, the 4px clearance on either side of an 8px glyph span inside a 16px SVG
is separate from button padding. Identify whether excess space comes from the SVG,
control target or parent layout, then review the relevant shared owner. This source
calculation table does not establish completed optical correction or design approval.
