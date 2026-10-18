# Design token contract

The authority is `components/core/design-tokens.ts`. App, Storybook, generated CSS and
JavaScript adapters consume this source. New UI must use Core's closed presentation APIs.
Feature-level numbers and local tokens cannot replace a shared presentation role.

## Foundations and roles

| Family           | Authority                                           | Usage                                                                |
| ---------------- | --------------------------------------------------- | -------------------------------------------------------------------- |
| Palette          | `primitiveTokens.colors`                            | Base theme assignments, preset overrides and authored color families |
| Spacing          | `primitiveTokens.spacing`                           | Named Core gaps, insets and padding                                  |
| Typography       | `fontSize`, `heading`, `fontWeight`, `lineHeight`   | Body, title and supporting text roles                                |
| Control geometry | `controlHeight`, `interaction`, `chrome`            | Closed control sizes, compact density and shared glyphs              |
| Composition      | `contentWidth`, `breakpoints`, `hierarchy`          | Content widths, responsive transitions and nesting                   |
| Surface behavior | `radius`, `border`, `opacity`, `layer`, `motion`    | Shared appearance and interaction feedback                           |
| Theme roles      | `semanticThemes`, `invariantTokens`, `themePresets` | Meaningful UI colors/effects; every preset shares role names         |

Spacing, font and control-height scales are defined once. Derived TypeScript roles read those
scales. `derivedTokenRoles` makes CSS aliases explicit; generated CSS references the foundation
instead of copying its current value. Changing a foundation therefore updates its dependents.

| Derived role                                                                                         | Foundation                                              |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `spacing-role-control-label`, `spacing-role-action-group`                                            | `spacing-xs`                                            |
| `spacing-role-control-label-compact`, `spacing-role-toolbar-item`, `spacing-role-field-label`        | `spacing-xxs`                                           |
| `spacing-role-field-column`                                                                          | `spacing-sm`                                            |
| `spacing-role-section`                                                                               | `spacing-xl`                                            |
| `control-padding-compact`, `control-padding-xs`, `control-padding-standard`, `control-padding-large` | `spacing-xxs`, `spacing-sm`, `spacing-md`, `spacing-lg` |
| `chrome-font-size`                                                                                   | `font-size-xs`                                          |
| `chrome-row-height`                                                                                  | `control-height-chrome`                                 |
| `chrome-section-row-height`                                                                          | `control-height-compact`                                |
| `heading-h4`, `heading-h5`, `heading-h6`                                                             | `font-size-lg`, `font-size-md`, `font-size-sm`          |
| `text-control-padding-xs`, `text-control-padding-md`                                                 | `spacing-xxs`, `spacing-xs`                             |

`text-control-padding-sm` (0.375rem, 6px at a 16px root) is an explicit off-scale exception. It is
TextButton's middle block padding between the `xxs` (4px) and `xs` (8px) steps and has no derived
foundation. Do not copy 6px elsewhere or treat it as a spacing step.

Square chrome commands use `control-height-chrome` directly; there is no separate chrome action size.

Role names remain public so existing consumers keep their meaning. Icon geometry is owned by
`chrome-icon-size`; equal body-font and icon dimensions do not make them the same semantic role.
Button accessory SVGs, TextButton's Core indicator, IconButton glyphs and DropdownMenu command SVGs consume this
same role, including wrapped SVGs. Consumers supply an icon without a numeric size. Core owns
the rendered dimensions and vertical alignment; image/avatar accessories retain their media
geometry. Post, Page, Work and Policy header actions and table row menus follow this contract.
Menu row height is a distinct compact-menu contract, not an alias of a coincidentally equal
heading size. Application header heights use rem and share the same responsive scroll offset.

## Type scale, document title and paper

One heading scale serves interface and document headings. `primitiveTokens.heading` holds the
base (below `sm`) sizes; `responsiveTokens.sm` restores the wider steps and `printTokens`
replaces the type roles on paper. The generator emits both as media blocks (print last, because
printed pages are wider than `sm`), so Core `Heading`, `.prose` and the Tiptap editor read the
same role at the same width and on paper. Do not add per-consumer breakpoints for headings.

The responsive steps belong to the global heading roles rather than to a separate document
heading family: a second scale would make interface `h1`–`h3` and authored `h1`–`h3` diverge on
phones, duplicate every heading selector and let the editor drift from the published view. On
phones interface headings that use scale 1–3 therefore shrink by 2–6px with the documents. A
responsive `scale` object remains for changing the role itself per breakpoint.

| Role                                      | Below `sm`               | `sm`+ | Paper (A4/Letter)                     |
| ----------------------------------------- | ------------------------ | ----- | ------------------------------------- |
| `heading-title` (Heading `scale="title"`) | 20px                     | 24px  | 15pt                                  |
| `heading-h1`                              | 16px                     | 18px  | 12pt                                  |
| `heading-h2`                              | 15px                     | 16px  | 11pt                                  |
| `heading-h3`                              | 14px                     | 14px  | 10pt                                  |
| `heading-h4` / `h5` / `h6`                | 13 / 12 / 11px           | same  | 9.5 / 9 / 8pt (follow `lg`/`md`/`sm`) |
| `font-size-xs/sm/md/lg/xl`                | 10 / 11 / 12 / 13 / 14px | same  | 7.5 / 8 / 9 / 9.5 / 10.5pt            |
| `heading-weight` (every heading)          | 500                      | 500   | 500                                   |
| `icon-size-xs/sm/md/lg/xl` (geometry)     | 12 / 14 / 16 / 18 / 20px | same  | same                                  |
| `line-height-md` (interface, dense text)  | 1.55                     | 1.55  | 1.5                                   |
| `line-height-document` (document text)    | 1.6                      | 1.6   | 1.6                                   |

`heading-title` is the document title role: Post (plain and hero), Page chrome and public
document details (Work, Event, Release, Artist, Label, Terms/Privacy and their history detail,
shared legal documents, Changelog) and the legal editor's title preview. It stays at least one
text-scale step (×1.125, ≥4px) above an authored body `h1` at every width and on paper;
`components/core/typography-scale.test.ts` enforces the order title > h1 > h2 > h3 > h4 > h5 > h6
and the published/editor heading parity, and the `PostHeadingHierarchy*`/`PageHeadingHierarchy`
stories assert it in the browser. Interface page titles keep `scale={2}`; they are not documents.

### Authored heading semantics

Size and outline depth follow the authored level; the rendered element follows the page outline.
A public document has one `h1`, its title, and no skipped levels. The document title layer owns the
offset: `ContentLayoutView` wraps its body in `DocumentHeadingScope` (`@/features/document-layout`)
with `parentLevel` 1 when it has chrome (the chrome renders the title `h1`) and 0 without. The
published renderers (`GeneratedRichTextBlockView`, `DefaultBlockView`) read the scope and render
authored H1 → `h2`, H2 → `h3`, H3 → `h4`, capped at `h6` (`documentHeadingTag`), with
`data-heading-level` carrying the authored level. Without a scope (an untitled CMS page, the
editor/published comparison) the authored element is kept, so the author's H1 is the page `h1`.
A body below a section label declares that label's level (Release/Label/Artist descriptions under
their `aria-level` 2 label: `parentLevel={2}`, H1 → `h3`); the legal editor preview declares 1 below
its title, and `policyTiptapDocumentToHtml(doc, { headingParentLevel })` does the same for its HTML.

`.prose` heading sizes key on `[data-heading-level]` and keep element-only fallbacks
(`.prose :where(h1:not([data-heading-level]))`, class-level specificity) for HTML without the attribute,
so a Core `Heading` inside `.prose` keeps its own role; no rule sizes a body heading
by its element alone (`typography-scale.test.ts`). Ids, the table of contents (authored levels),
the scroll spy (ids) and Markdown export (`#` per authored level) are unchanged. Screen (390, 834, 1440) and A4 sizes were measured identical before and after (typography audit `compare`).

Paper sizes are physical points so a printed document is 10.5pt running text with code, tables
and captions at 9pt (`sm`) and metadata at 8pt (`xs`). Feature and print CSS consume the same
role names (`var(--geul-font-size-sm)`), never a literal size. The token scanner reports
`raw-font-size` for literal `font-size`, `line-height` and `font` values in any unit (including
`pt`, `%`, viewport units and keywords), in print rules too, and for TS style/option objects,
DOM style and canvas `font` assignments. `authoredTypographyFiles` in
`scripts/design-system/token-policy.mjs` names the only exceptions: generated share-image
artwork, the immersive scene title artwork and the error-code particle canvas.

### Document leading and block rhythm

`line-height-document` (1.6, owner decision 2026-10-18; it was 1.7) is the leading of running text in document
bodies, one value for every language and script: published `.prose` paragraphs, list items and their
markers, quotes, callout copy and check-list items, the same Tiptap editor blocks, and Core
`List leading="document"` (changelog release notes). Interface text keeps `line-height-xs`–`xl`
paired with its size, dense document content (tables, code, captions) keeps its interface role, and
headings keep `heading-line-height`. Paper uses the same 1.6 at 9pt, above the dense 1.5 because the
A4 measure is long and Hangul glyphs fill the em box, so the return sweep needs the extra leading. A Core `Heading` inside a `.prose` region (for example the legal editor's preview title)
keeps its own role: the `.prose` heading element fallbacks have class-level specificity (`:where`).

Blocks of a document body are `spacing-md` (12px) apart: paragraph → paragraph, paragraph ↔ quote,
callout, list, media, table and code. Items of one list (the same list kind in a row) stay
`spacing-xs` (8px) apart. A heading that follows content opens `spacing-xl` (24px) above it and
keeps `spacing-xs` below. The heading step moved from `lg` with the paragraph gap: before, the
heading's 16px was twice the 8px block gap; against a 12px gap 16px would leave the heading almost
equidistant between two sections, so `xl` restores 2:1 above and keeps the heading closer to its
text than paragraphs are to each other. `lib/styles/document-content.css` owns the rules for
published blocks, materialized HTML, nested children and callout content, and Tiptap's block group
(its flex gap stays `xs`; margins add the difference), so the editor and the published view measure
equal (`typography-audit.mjs gaps`, and the `Feature/Editor/Public Block Comparison` plays).

`chrome-font-size` and `chrome-section-font-size` alias `font-size-sm` (11px) for navigation and section
overlines (SideNavigation, DropdownMenu), so chrome Hangul, Kana and Han never drop below 11px. The text
scale steps one pixel (owner decision 2026-10-18): `xs` (10px) is reserved for captions, badges and
field help, never for navigation or running text.
Geometry that sits beside text (icons, logo defaults, check-list boxes, emoji choices) uses `icon-size-*`,
so it keeps its size when the text scale changes. Coarse-pointer text fields keep 16px through
`interaction-text-minimum`.
Uppercase labels separate from running text by `letter-spacing-caps` (0.04em) and weight, not size.

## Content widths

`contentWidth` roles are content maximums, not breakpoints: `form` (28rem) single-column
account forms; `reading` (32rem) the running-prose measure of long documents; `compact`,
`standard` and `wide` (48/62/75rem) LayoutContainer surfaces and document breakout widths.
`reading` was added on 2026-10-13 for a repeated meaning: running text and the chrome that shares
its column. Posts, legal documents (current, preview, history, share), the changelog and work/event
detail pages read on it; CMS page sections keep their own widths and do not offer it (their
`narrow` width serves bounded text sections). One width serves every language and script (owner
decision 2026-10-18: it narrowed from 44rem with the 12px body): a full line measures about 85 Latin,
55 Hangul and 110 Arabic characters, spaces included.
CSS consumes `--geul-content-width-reading`; React
layout uses `LayoutContainer size="reading"` and `ContentChrome measure="reading"`. It is a screen
measure: `LayoutContainer size="reading"` drops its maximum on paper, where the print page measure
applies. Feature CSS must not copy the value.

## Layer scale

`primitiveTokens.layer` is the only stacking authority. Generated CSS exposes `--geul-layer-*`;
`components/core/layer-contract.ts` projects the same values as numbers (`overlayLayers`) for
React Aria portals and inline styles. Roles are listed in ascending order.

| Layer      | Value | Meaning and consumers                                                                         |
| ---------- | ----- | --------------------------------------------------------------------------------------------- |
| `sticky`   | 100   | Page-owned pinned surfaces under application chrome: TableOfContents, Post editor zen surface |
| `backdrop` | 200   | Modal underlay. ApplicationFrame header/navigation use `backdrop - 1`                         |
| `modal`    | 201   | Modal and drawer dialogs                                                                      |
| `banner`   | 250   | Viewport-pinned notices: cookie consent, draft-mode alert                                     |
| `floating` | 260   | Non-modal floating tools (FloatingPanel); their own popups and tooltips stay above            |
| `popup`    | 300   | Menus, popovers, listboxes, sortable previews                                                 |
| `toast`    | 400   | Notification toasts, above modals and popups, below tooltips                                  |
| `tooltip`  | 1000  | Tooltips                                                                                      |
| `progress` | 10000 | Route progress bar; always topmost                                                            |

Banner and floating sit above `modal` because ApplicationFrame chrome occupies the slot directly
below the backdrop and these surfaces must clear the fixed header and workspace navigation. Moving
them below modals requires ApplicationFrame to consume a lower named chrome layer first.
Local stacking inside a component or canvas (`z-index: 1`, media resize handles, map loading
surfaces) is not part of this scale and must not borrow a global layer.

Breakpoints are not emitted as CSS variables because media queries cannot read them. JavaScript
uses `primitiveTokens.breakpoints`; CSS media queries use the generated PostCSS projection
`lib/styles/design-breakpoints.json` (`$mantine-breakpoint-*`).

## Motion

`motion-fast` (100ms), `motion-normal` (140ms) and `motion-slow` (300ms) time state transitions with
`motion-easing`. `motion-spin` (1000ms) is the single loading-rotation period consumed by
`components/core/Spinner.module.css`; it is deliberately calm and is not a transition duration.
Reduced motion stops rotation and transitions at their owners.

## Theme selection

`lib/theme/themes.ts` defines the `ThemeId` registry: `light`, `dark`, `ocean-light`
and `ocean-dark`. Each preset chooses a base scheme and overrides existing semantic
roles with existing primitive colors. `getThemeTokens()` resolves the complete role
map; `themeVariables()` projects it to CSS. Presets do not add component tokens,
spacing scales or independent command/status meanings.

The shared `DesignSystemProvider` owns the document projection, including portaled
surfaces. `data-geul-theme` records the base scheme; `data-geul-theme-id` records the
selected preset. Storybook's theme toolbar passes `forceTheme` through this provider.
Preview changes do not read or write saved application preferences. Application
preferences remain light, dark and automatic system mode.

Add a recurring custom theme in this registry and verify its text, surface, command,
status, chart and focus combinations. A role name cannot change meaning between
presets. Components must read semantic roles rather than select a palette locally.

## 2026-10-12 consolidation and migration

Removed seven unused semantic roles from both base themes: `wave-progress-soft`,
`media-surface`, `media-control`, `track-muted`, `track-border`, `track-fill` and
`shadow-docked`. Their CSS variables and TypeScript semantic keys are removed together.
The source audit found no current production consumer, theme override, derived alias,
adapter lookup or test reference outside central definitions. Generated references and
historical review excerpts were not counted as consumers. This repository no longer
owns a DTCG export pipeline; no token exchange file requires a second update.

| Removed family            | Current production authority                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Wave progress             | `readWaveMediaColors` consumes `action-primary`; waveform and cursor retain their distinct `wave-muted` and `wave-cursor` roles.     |
| Media surface and command | `MediaAudioFrame` consumes the shared Section surface. `MediaTransport` commands consume Core Control state roles.                   |
| Legacy track colors       | The persisted timeline adapter consumes `border-strong` and `action-primary`. New player transport uses the shared waveform adapter. |
| Docked shadow             | No current docked-shadow consumer remains. Existing surfaces retain their own documented shadow roles.                               |

No in-repository consumer migration is needed. A copied stylesheet or external runtime
that names a removed variable must migrate to the current owner above before consuming
this source change. Do not add fallback aliases that preserve an unused parallel role.

The spacing cleanup reuses existing relationships: table command groups now use
`action-group` instead of a local `xxs` choice, so their gap changes from 4px to 8px at
a 16px root and retains wrapping. Media command clusters use `toolbar-item` (4px);
outer media groups and video settings commands use `action-group` (8px). Clock content
retains the `xxs` scale because its separators are content, not commands.

Equal values do not imply equal roles. `control-label` and `action-group` both resolve
to 8px but express internal accessory alignment and external command separation.
`field-label` resolved to 8px until 2026-10-13 and now resolves to 4px (`xxs`) so Core
Field and every Core Input share one stacked label–control–help rhythm. They remain
separate aliases even when their values coincide.
Palette grades, persisted document color names, menu row height and glyph/target roles
also retain their distinct contracts. No new roles or migration-baseline allowances
were added. The production spacing audit found no nonzero literal gap/padding/margin
debt within its declared CSS property scope; geometry and print exceptions remain explicit.

Review the actual examples in `Foundations / Spacing`, `Foundations / Iconography`,
`Composition / Table Toolbars / Action Group` and `Core / Media / MediaControls`.
Source and automated checks do not establish viewport or design approval.

## 2026-10-12 role cleanup and migration

| Removed or renamed                                                                                                                                                                                                                     | Replacement                                                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `--geul-action-hover`                                                                                                                                                                                                                  | `--geul-surface-hover` (identical in all four presets)                  |
| `--geul-action-pressed`                                                                                                                                                                                                                | `--geul-surface-active` (identical in all four presets)                 |
| `--geul-chrome-action-size` / `primitiveTokens.chrome['action-size']`                                                                                                                                                                  | `--geul-control-height-chrome`                                          |
| `--geul-breakpoints-*`                                                                                                                                                                                                                 | `primitiveTokens.breakpoints` (JS) or `$mantine-breakpoint-*` (PostCSS) |
| `text-image-chrome`, `shadow-image-chrome`, `paper-border-soft`, `overlay-muted`, `overlay-video-status`, `overlay-border-muted`, `overlay-caption`, `overlay-spinner-border`, `shadow-media`, `shadow-map-panel`, `shadow-image-text` | None; no consumer existed                                               |

`action-boundary` remains: it is the meaningful outline of an outlined command, distinct from
`border-strong` (input underline and control outline). Ocean Dark no longer repeats base-dark
values for `background` and `surface-hover`. In the light theme `action-warning`,
`-hover` and `-pressed` now use yellow 700/800/900 so pressed differs from hover, matching
the accent/positive/danger ramps; label contrast on the lightest fill is 4.72:1.

New layer roles `sticky`, `banner`, `floating`, `toast` and `progress` replace Core and
Feature numeric literals (100, 999/1000, 150, 1000, 10000). Toasts moved from `tooltip` to
`toast`. A copied stylesheet that names a removed variable must migrate to the replacement.

## Extension rules

1. Use an existing Core component and named role first. Adjust composition through Core Layout.
2. If the shared component cannot express a recurring requirement, extend its closed Core
   contract and update its consumers, stories and type/runtime checks together.
3. Add a token only for a reusable meaning that existing roles cannot express. A one-off value
   or another spelling of an existing role is insufficient.
4. Keep state/size calculations private (`--_...`) and derived from registered tokens. No
   additional public feature-level palette or spacing scale is permitted.
5. Authored documents, provider identities, canvas/map and physical print geometry have their
   documented owners. Their independent dimensions do not authorize arbitrary product chrome.

## Verification

`generate-tokens.mjs` rejects missing foundations, alias chains and differences between a derived
TypeScript role and its foundation. Generated CSS must match the authority. Projection tests
check both JavaScript values and CSS references.

Token, responsive, layout, framework and action checks enforce the existing presentation
boundaries. Type/runtime tests cover the affected Core APIs. Actual browser screenshots verify
alignment, themes, localized text and phone layouts. Passing a source scan alone is not visual
approval; untyped/dynamic composition still needs review.

Application type checks exclude the `stories` tree consistently in both the default and local
contract projects. `.storybook/tsconfig.json` owns story fixtures and interaction tests and must
also pass. The local contract project does not relax dependency declaration checking to absorb
Storybook-only declarations. The token audit counts authored color definitions by their durable
role names, whether their generated values are literals or references to shared palette tokens.
The shared Storybook fixture projector also localizes React elements/fragments in action slots
and action arrays; it preserves event handlers, identifiers and authored row values. Header and
toolbar previews must exercise these composed slots under the locale and theme toolbar.

Core EditorHeader's collaboration indicator is an example: its glyph consumes the shared icon
token, numeric size overrides are closed, and the status/title and action groups align centrally.
Post, Page, Work and Policy editors consume this owner rather than patching local margins.
