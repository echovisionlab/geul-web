# Carbon reference adoption review

Reviewed: 2026-10-12. **Draft: official reference/source comparison and proposals**.
This is not a record of completed app comparison, Core adoption or full Storybook review.
Follow the [review order](review.md): Button → Field → Toolbar → Table → App Dialog.
Official code was checked at Carbon commit `47ab67155b185d56bf147b33cd9536e479ab0203`.

## Buttons and icons: values and roles

| Subject          | Official Carbon basis                                                                                                                                                                                                             | Geul choice and review                                                                                                                                            |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Command default  | React Button uses kind=primary. [Source](https://github.com/carbon-design-system/carbon/blob/47ab67155b185d56bf147b33cd9536e479ab0203/packages/react/src/components/Button/Button.tsx)                                            | Retain neutral/medium, IconButton neutral/low and the existing palette. Carbon primary does not become the ordinary app-command default.                          |
| Label↔icon       | Ghost uses 8px (`spacing-03`), distinct from ordinary button examples with 16px or more/32px. [Specifications](https://www.carbondesignsystem.com/building-blocks/core/components/button/specifications)                          | Compare shared 8px gap and the existing compact-header 4px gap. Do not copy 32px into unfilled commands.                                                          |
| Glyph            | Ordinary buttons use 16×16; expressive uses 20×20. Same specifications.                                                                                                                                                           | Retain `chrome-icon-size` 16px. Larger button heights do not automatically enlarge the glyph.                                                                     |
| Icon-only box    | SCSS uses padding=0, width/height=layout height and ghost icon margin=0. [SCSS](https://github.com/carbon-design-system/carbon/blob/47ab67155b185d56bf147b33cd9536e479ab0203/packages/styles/scss/components/button/_button.scss) | Geul also uses padding=0. Do not add the documented icon-only 16px clearance as padding to every size. Separate square target, viewBox clearance and wrapper gap. |
| Control height   | Carbon xs/sm/md/lg=24/32/40/48px; full-bleed xl/2xl=64/80px. [Specifications](https://www.carbondesignsystem.com/building-blocks/core/components/button/specifications)                                                           | Retain Geul xs/sm/md/lg/xl=30/36/42/50/60px, compact=28, chrome=32px and compare actual consumers first. Matching size names do not imply matching values.        |
| Between commands | Carbon fixed button-group spacing of 16px is composition guidance, not a value built into each button. Same specifications.                                                                                                       | Separate internal command gap from external action-row gap. Do not set every toolbar/table control gap to 16px.                                                   |

IBM artboard padding is **clearance inside the glyph frame**. Optical path bounds do not always fill the live area.
[IBM UI icon usage](https://www.ibm.com/design/language/iconography/ui-icons/usage/).

| Artboard | Internal padding | Live area | Official SVG viewBox example                                                                                                                         |
| -------- | ---------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 16px     | 1px              | 14px      | [0 0 16 16](https://github.com/carbon-design-system/carbon/blob/47ab67155b185d56bf147b33cd9536e479ab0203/packages/icons/src/svg/16/arrow--right.svg) |
| 20px     | 1.25px           | 17.5px    | [0 0 20 20](https://github.com/carbon-design-system/carbon/blob/47ab67155b185d56bf147b33cd9536e479ab0203/packages/icons/src/svg/20/arrow--right.svg) |
| 24px     | 1.5px            | 21px      | [0 0 24 24](https://github.com/carbon-design-system/carbon/blob/47ab67155b185d56bf147b33cd9536e479ab0203/packages/icons/src/svg/24/arrow--right.svg) |
| 32px     | 2px              | 28px      | [0 0 32 32](https://github.com/carbon-design-system/carbon/blob/47ab67155b185d56bf147b33cd9536e479ab0203/packages/icons/src/svg/32/arrow--right.svg) |

IBM documents a 32px production grid and optical centering in its [design guidance](https://www.ibm.com/design/language/iconography/ui-icons/design/).
Geul's [IconButton](../../components/core/IconButton/IconButton.tsx) displays Tabler viewBox24 glyphs in a 16px box.
Do not apply IBM's filled glyph/stroke/Plex combination directly to Tabler/Noto or crop paths to fill the frame.
Compare original proportions, optical alignment and stroke weight; record glyph clearance, CSS padding and target size separately.

IBM's touch guidance requires at least 44px and can use CSS clearance around a small glyph.
[IBM clearance](https://www.ibm.com/design/language/iconography/ui-icons/usage/).
Retain Geul's coarse-pointer 44px minimum and 16px input text.
This does not require every fine-pointer icon target or glyph to become 44px.
Do not equate this value with WCAG AA's minimum target criterion. See the [Geul density contract](size-density-contract.md).

## Spacing proposals and actual comparison

Carbon distinguishes small internal spacing from larger grouping in its 2/4/8px-based scale;
Stack owns spacing between children. Token values themselves do not vary with screen width.
[Spacing](https://www.carbondesignsystem.com/building-blocks/foundations/spacing/overview).
Geul's [token owner](../../components/core/design-tokens.ts) uses 4/8/10/12/16/24px.
Do not remove 10px simply because it is absent from Carbon.

Define glyph size, label-icon gap, control inline padding, action-row gap and section spacing as shared roles that reference the existing scale.
Keep meaning distinct even when values match. [Control CSS](../../components/core/Control.module.css) owns button/icon internals;
[control-context](../../components/core/control-context.tsx) owns size inheritance; Core Layout/Toolbar owns external composition.

When icon clearance looks excessive, measure computed control box, glyph frame/path bounds, actual padding, parent gap and
ActionRowSizeProvider/ToolbarDensityProvider inheritance first.
Fix unnecessary wrapper space or incorrect density inheritance at the shared owner.
Compact HeaderDensity uses the existing 4px internal gap; compact control size is 28px.
Compact size alone retains the ordinary 8px label gap. Coarse targets occupy at least 44px without overlap.
Do not uniformly reduce height/width, SVG proportions or outlines without measurements.

Compare actual consumers across valid Button APIs, default/hover/pressed/focus/disabled/pending, Light/Dark,
long Korean/English, RTL, labelWrap and sections/indicator.
390/834/1440px are representative mobile/tablet/desktop widths; include 320px and Geul breakpoint boundaries.
Verify Tab, Space/Enter, names, toggle state and pending locks through actual behavior.
Carbon covers icon-only hover/focus names separately from toggle semantics in [Button accessibility](https://www.carbondesignsystem.com/building-blocks/core/components/button/accessibility).
Geul href retains navigation-link semantics. Do not apply Carbon's button-role link policy to every link.
Review tooltip visibility, accessible names and touch separately; Carbon's accessibility results are not Geul evidence.

## Storybook documentation and example standards

Carbon 2x Grid describes product-screen structure: an 8px mini unit, fixed padding 16px,
32px gutters when needed and 4/8/16 columns by breakpoint.
[2x Grid](https://www.carbondesignsystem.com/building-blocks/foundations/2x-grid/overview).
Geul retains its existing breakpoint/content-width owners.

Use the same document order: purpose, anatomy, public API, geometry, states, content, responsive behavior,
accessibility, consumers and verification scope.
Examples use production Core and link to the contract/source owner.
Documentation specimen padding and maximum widths are not product specifications.

Core examples isolate component geometry and states. Composition examples review parent gaps and reading order.
Pages examples review actual View tasks and failure/recovery. Distinguish fixed-state specimens from actual interactions.
Document headless providers and hooks by responsibility and behavior.

Compare the same source, args, theme and locale at 390/834/1440px.
Record actual iframe CSS viewport, wrapper/product surface widths and pointer conditions.
Review long content, resizing, Light/Dark and keyboard states in the browser; retain unexecuted checks as pending.
Follow shared preview and toolbar ownership in the [Storybook guide](../ui-kit.md).
