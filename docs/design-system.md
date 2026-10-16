# Geul design system

Storybook is the working documentation and review surface for Geul design system.
It contains foundations, component contracts, reusable compositions and page documentation
with executable examples. Adopted definitions remain in the repository's tokens, theme and Core.
Read the [Storybook guide](./ui-kit.md), [component documentation](./design-system/component-documentation.md)
and [page documentation](./design-system/page-documentation.md) for the required structure.
The [compact product interface contract](./design-system/compact-interface-contract.md) connects
loading, dialogs, metadata, link forms and automatic pagination to their shared Core owners.

The [ownership contract](./design-system/ownership-contract.md) defines the typed API,
stylesheet boundary and consumer evidence required for system changes. The
[generated catalog](./design-system/generated-inventory.md) records current owners and previews.
A passing token check does not approve every component or page.

Geul uses a quiet, text-led interface: neutral surfaces, aligned labels and values, square controls,
and color reserved for interaction or status. Product body text and dense tool chrome have distinct
scales. Existing locale fonts, right-to-left layouts and readable content typography remain part of
the system. The reference direction is Monome/norns, TX–6, Rams/Braun, Ableton and Valhalla; these
references guide hierarchy and repetition rather than introduce hardware-shaped controls. Reference
pages: [norns](https://monome.org/docs/norns/play/), [TX–6](https://teenage.engineering/products/tx-6),
[Rams](https://www.vitsoe.com/us/about/good-design), [Live](https://www.ableton.com/en/live/), and
[VintageVerb](https://valhalladsp.com/shop/reverb/valhalla-vintage-verb/).

## Sources of truth

| Concern                                          | Authority                                                                                                |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Palette, spacing, type, control geometry, motion | `components/core/design-tokens.ts` → `primitiveTokens`                                                   |
| Light/dark role assignment                       | Same module → `semanticThemes`                                                                           |
| Image overlays, media canvases and print roles   | Same module → `invariantTokens`                                                                          |
| Framework-independent theme projection           | `theme.ts`, shared by app and Storybook                                                                  |
| Named theme definitions and overrides            | `lib/theme/themes.ts`; existing semantic roles and primitive palettes                                    |
| CSS projection                                   | Generated `lib/styles/design-tokens.css`; do not edit it by hand                                         |
| Existing CSS variable compatibility              | `lib/styles/variables.css`; aliases preserve consumers                                                   |
| Site branding fallback                           | `lib/theme/site-brand.ts`, backed by the shared primitive                                                |
| User-authored editor colors                      | Document roles in `design-tokens.ts`; durable `--editor-*` compatibility aliases                         |
| Component/route/preview inventory                | [Generated catalog](./design-system/generated-inventory.md)                                              |
| Functional categories and inspected behavior     | [Feature specification](./ui-feature-specification.md)                                                   |
| System documentation and executable inspection   | [Storybook guide](./ui-kit.md)                                                                           |
| Component and page documentation                 | [Components](./design-system/component-documentation.md), [Pages](./design-system/page-documentation.md) |
| Carbon reference and completion criteria         | [Writing criteria](./design-system/carbon-reference.md)                                                  |
| Core anatomy, states and source contracts        | [Core specifications](./design-system/core-specifications.md)                                            |

Named editor colors follow the [editor color contract](./design-system/editor-color-contract.md).
Mermaid diagrams follow the [Mermaid theme contract](./design-system/mermaid-contract.md).
Hierarchy spacing follows the [hierarchy contract](./design-system/hierarchy-contract.md):
the system provides a default step; consumers can select existing named spacing tokens through
Core Hierarchy. Title alignment and reorder tracks retain their own roles.

## Token use

The [token contract](./design-system/token-contract.md) records foundations, derived roles,
the boundary for new tokens and the checks that prevent a derived role from drifting.

The shared spacing scale is compact: `xxs/xs/sm/md/lg/xl` are 4/8/10/12/16/24px
at the default root size. Layout gaps, insets and component padding consume this same
scale; individual Features must not recreate earlier spacing with local CSS.
Repeated label, action-group, toolbar-item, Field and section relationships consume
foundation aliases defined in the [spacing and icon contract](./design-system/spacing-icon-contract.md).
Core Layout accepts `gap="action-group"` and `gap="section"` for external relationships;
internal control gaps remain owned by the control.
DropdownMenu owns 26px fine-pointer minimum rows (44px with any coarse pointer) and 2px vertical / 4px horizontal row padding.
DocumentColorPreview owns compact trigger samples and 26×20px choice
samples; DropdownMenu's typed `colorPreview` slot consumes those samples without
squeezing them into the icon track. Editor color and block menus consume this owner.

Use Core's semantic props (`tone`, `emphasis`, `appearance`, `shape`) for controls. Use Core Layout named spacing and responsive props for composition. In CSS use stable role variables, for example
`color: var(--geul-text-secondary)` or `gap: var(--geul-spacing-sm)`. TypeScript inline styles can
use `tokenVar('surface-muted')`; its argument is a checked union of registered color/effect roles.

Roles are stable across Light and Dark. The same role does not change meaning when values change.
Different roles may intentionally resolve to the same value. Merge aliases when their meanings
coincide, not merely because their current hex values are equal. Keep component-specific aliases
private (`--_...`) and derive them from shared tokens. Public local variables already consumed by
other components are migration debt until their API is reviewed.

Theme projection is framework-independent. Core controls use React Aria; Mantine hooks and form utilities
remain implementation dependencies. Compatibility CSS names do not grant a second visual authority.
Ordinary interaction stays neutral. Filled controls use `text-on-action`; text over photographs uses
`text-on-image`. Generated CSS supports initial OS dark preference and explicit theme selection.
Geometry uses rem values. Authored media, map and print geometry retain their own owners.

## Named themes and compact composition

[Theme definitions](../lib/theme/themes.ts) own `ThemeId`: `light`, `dark`, `ocean-light` and `ocean-dark`.
The registry exports `themeDefinitions`, `getThemeDefinition`, `getThemeTokens` and `normalizeThemeId`;
`themeVariables(ThemeId)` projects the selected definition.
Ocean Light overrides 14 existing semantic roles; Ocean Dark overrides 9. They reuse existing primitive palettes
and introduce no new semantic names or primitive colors.

The shared provider's `forceTheme` supports preview selection. It exposes `themeId` and the definition's base
`computedColorScheme`. `data-geul-theme` remains `light`/`dark` for existing CSS, editor and media contracts;
`data-geul-theme-id` identifies the selected preset. Theme variables reach the document root and portaled UI.
Switching, unmounting and nested providers restore owned overrides and the original inline priorities.
Forced/inherited previews do not read or write the application's saved light/dark/auto preference.
Custom presets are preview selections; the application preference API remains light/dark/auto.

Compact composition continues to use existing Core size, spacing and density roles.
Theme choice does not change the coarse-pointer minimum, keyboard behavior or command emphasis contract.
Contrast/provider regressions for the four definitions passed 105 matching tests. Actual browser visual review
and assistive technology integration remain separate acceptance steps.

## Size, density and responsive composition

| Role                        | Fine pointer geometry             | Composition / coarse pointer              |
| --------------------------- | --------------------------------- | ----------------------------------------- |
| General controls            | xs/sm/md/lg/xl = 30/36/42/50/60px | Same named scale, minimum 44px            |
| Compact commands and inputs | compact = 28px                    | Minimum 44px; glyph remains 16px          |
| Chrome icon commands        | chrome = 32px                     | Minimum 44px                              |
| Menu row                    | 26px minimum                      | Minimum 44px                              |
| Prose link                  | Natural text line                 | Content typography, no command row sizing |

`ActionRowSizeProvider` owns the row size across Button, IconButton and chrome TextButton.
A compact Toolbar owns compact geometry before the row context; a standalone command uses its named size.
Do not use the retired `compact-xs` or `touch` sizes. Input density controls compact geometry;
font size remains its own role. Coarse text inputs use at least 16px text. `any-pointer: coarse`
sets the shared interaction minimum, including hybrid devices. Targets occupy layout space.
ToolbarSurface wraps by default; explicit nowrap provides horizontal scrolling. Responsive toolbar
commands retain labels for touch input. ReorderGutter reserves a leading track on touch and the existing
outside gutter on fine pointers. This changes chrome without changing authored document hierarchy.

Select `width="content"` measures labels through its Core-owned sizing track, including accessory geometry;
it clamps to available width and fills narrow screens. Feature consumers do not copy those calculations.
Label and Post participants share ParticipantRow; each domain retains permissions and mutations.
Artist, Label and Release descriptions share CompactTiptapEditor's square frame, minimum writing area
and readOnly behavior. Read-only text remains selectable; style/className escape props are rejected.

CSS media/container rules consume generated `$mantine-breakpoint-*` compatibility variables.
JavaScript and image sizes consume `breakpointQuery(name, 'below' | 'at-least')`.
Below uses `<` and at-least uses `>=`, so exact boundaries have one owner.
LayoutContainer's reading/compact/standard/wide widths use separate contentWidth roles (36/48/62/75rem);
`reading` is the running-prose screen measure; paper keeps the page measure ([table of contents and reading measure](design-system/table-of-contents.md#reading-measure)).
A layout transition and a content maximum are independent decisions.
Three exact component geometry exceptions remain in responsive-policy: upload placeholder container,
map callout scale and Mermaid figure. These do not authorize new screen-level numeric breakpoints.

## Browser baseline

`lib/styles/base.css` is the shared CSS reset loaded by `app/layout.tsx` and
`.storybook/preview.tsx`. Keep this baseline identical in application and preview;
it runs before JavaScript. It normalizes border-box sizing, body margin, form-control
margin and inherited typography/color, and supported mobile text inflation at 100%.
This does not disable user zoom. See [MDN text-size-adjust](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/text-size-adjust).

Core components own native appearance, padding, borders, focus, disabled states and
explicit geometry. Do not globally use `all: unset`, remove focus outlines, or apply
`appearance: none` to every input: native file, range and choice controls have separate
contracts. Document typography belongs to `document-content.css` and Core Typography.
Reset CSS cannot replace constraints on native inputs' intrinsic widths; explicitly
size tracks in Core and verify the rendered result in Firefox and Chromium. Responsive
review also covers phone widths, light/dark, localized text and keyboard editing.

## Control language

Core `EditorHeader.saveState` accepts `saved`, `saving`, `offline`, `error`, and `reload`.
The authoring header resolves this from the room phase and registered pending saves; a connected
socket alone never means a block-room edit is durable. `CollabSyncStatusIndicator` accepts
`state` with a required localized `label`; its transport-only compatibility props cannot be mixed
with `state`. Saved uses the existing positive token, saving/rebuilding warning, errors danger,
and offline muted. Its Core-owned size, tooltip placement and header layout are unchanged.
The icon has an accessible name, while a single shared notification announces failure and
recovery of local edits. Avoid a live announcement for every keystroke. Stories under
`Core/Layout/EditorHeader` exercise every state and its tooltip. Post, Page, Work, Artist,
Label, Release, Program Event, Campaign, legal policy and email-template editors consume the
same authoring adapter.

Core `CollabSyncStatusIndicator` uses the same `chrome-icon-size` as command glyphs.
Its wrapper owns inline-flex centering and a zero line-height; glyph baselines do not decide
its position. Numeric `size` overrides are rejected by TypeScript and at runtime. EditorHeader
centers the title/status and command groups on desktop and retains its separate compact action
row on phones. Post, Page, Work and Policy editors consume this shared owner.

PIN entry alignment belongs to Core `PinInput.align="start|center|end"`. AuthCodeChallengeView
uses `center` for the actual digit group in login and email verification.
The digit group uses 4/6/8 equal grid tracks sized by existing control and gap tokens, clamped to
available width. It does not use flex fit-content sizing, whose native-input intrinsic width
made the group expand and leave digits at the leading edge in Firefox. Review actual Firefox
and Chromium screenshots as well as interaction tests before accepting PIN alignment.
Focusing selects an
existing digit for replacement; Backspace clears the current digit or the previous digit from
an empty cell, Delete clears the current cell, and arrows move between cells. Paste/OTP completion
submits only a complete value without gaps. Controlled stories own immediate local email/code state
and synchronize external Controls changes; input keystrokes must not wait for Storybook's args channel.
Verification titles retain h2 semantics and use the existing h3 scale on phones, h2 from sm.
Auth challenge expiry text precedes one centered, wrapping action row: resend uses neutral/medium,
start over uses neutral/low, and both use the same small Core Button scale and surface feedback.
The local page preview owns simulated verification; component state stories never send email.

Core Button defaults to `neutral / medium`: a transparent surface and medium-weight label.
Supporting controls use a surface change on hover; they do not use a link underline.
`low` uses quieter ink. Ordinary secondary actions such as changing email or connecting an
account remain borderless; `outline` is an explicit functional-boundary exception. Inline TextButton navigation retains glyph
underline feedback. IconButton uses surface feedback and retains its accessible name and target
size. Keyboard focus is a separate visible two-pixel ring.

Menu/disclosure openers, add-row entrances, filters, pagination and toolbar
alignment controls use `medium` or `low`, including their selected state.
Core derives persistent selection feedback from `aria-pressed="true"` and
`aria-current="page"`/`"true"`; callers must supply the appropriate semantics.
Toggles pass IconButton/ToolbarCommand `pressed`; callers do not choose tone or emphasis for the
selected state. Exclusive icon view modes use SegmentedControl icon options with a required accessible label.
These states use the muted surface rather than the inverse principal-action fill.
Navigation rows and chrome controls use surface feedback; only inline content
navigation uses glyph underline feedback. A fill over an image or map can remain
when it supplies the contrast boundary required to read an overlay control.

Use `strong` deliberately for a committing or emphasized action. `tone` selects meaning and color;
`emphasis` selects the amount of surface treatment. Explicit accent/positive/warning/danger controls
use semantic ink for medium/low/outline and the corresponding `action-{tone}` fill, hover and pressed roles
for strong. Neutral stays achromatic in the standard Light/Dark palettes. Custom presets may
intentionally override neutral ink and primary-action roles while preserving command tone/emphasis semantics.
All theme definitions use `text-on-action` for readable filled labels;
Filled controls have no border or inset pressed outline; pressing changes their fill.
Disabled overrides tone, while the outside keyboard focus ring remains independent. Ordinary controls retain their
neutral/medium default. Adding a control does not automatically justify a strong fill.

Explicit user requests may authorize a scoped color or emphasis exception. Record the scope here
and implement it through Core tokens and closed semantic props, then let the shared Feature select
the intended treatment. Authorization does not create a Feature-local CSS styling authority.

The shared [confirmation Feature](design-system/confirmation-contract.md) selects intent explicitly:
delete/discard/revoke use danger/strong; archive uses warning/strong, restore positive/strong,
regenerate warning/strong, and ordinary confirmation neutral/strong. Core ConfirmModal defaults to
neutral/strong and exposes `confirmTone`/`confirmEmphasis`; it does not infer deletion from its label.

The shared OverlayDialog explicitly declares `aria-modal="true"` on its `dialog`/`alertdialog`
container. ConfirmModal, FormModal, ContentModal, BlockingAlertDialog and Drawer inherit this
contract. React Aria owns background isolation, focus containment/restoration and dismissal;
features supply content and commands through the shared surfaces. Accessibility tests verify
both the modal declaration and the actual isolation behavior.

Dialog primary actions are a user-authorized filled-action scope: confirmation, form submission,
upload/file selection, insertion, saving, scheduling and the acknowledgement in BlockingAlertDialog
use Core Button `strong` with their existing semantic tone. FormModal owns its filled submit action;
composed ContentModal flows explicitly select `strong` for the primary action. Cancel, close,
back, tabs, menus, row controls and preparatory actions keep `medium`/`low`. Ordinary Button
controls outside this scope retain `neutral / medium`; dialog placement alone does not fill every control.
The shared editor file insert view owns the filled browse/upload action, and the file library's
multiple-selection footer owns the filled add action. ImageCropper uses the same confirm treatment.

Cookie consent now uses equal compact Core TextButtons for Reject and Accept all.
The fixed notice discloses essential operation cookies and the single optional Google Analytics category.
Rejection is immediately available beside acceptance; neither action is hidden in the policy text.
Account settings retains a draft Analytics switch and explicit Save preferences.
See [cookie consent](design-system/cookie-consent-contract.md) for the current decision and persistence contracts.

SectionCard defaults to borderless grouping. Titles, spacing and alignment establish
structure; explicit borders are reserved for functional containment. See the [purpose-based language](design-system/ownership-contract.md).

Document editors share the application's `md` outer gutter. URL, summary, metadata, share and translation
sections use SectionCard's responsive named inset (`none` on mobile, `md` from `sm`) so mobile content
does not acquire another gutter. Post, Page and Work use the shared authoring `DocumentEditorPanels`:
mobile opens the writing tab first and keeps document settings in a second neutral line tab;
desktop retains the settings/body flow. Section gaps use `xl` on mobile. The body has no duplicate
“Body” heading inside its tab. Core LayoutBleed compensates the outer mobile gutter for the body,
which retains Tiptap's existing internal padding and leading block-control gutter.
Core EditorHeader uses one title row and one compact context/command row on mobile.

Editor chrome uses the following roles in every viewport; it must not borrow the document's type scale:

| Role                                 | Core contract                                    | Token                                                      |
| ------------------------------------ | ------------------------------------------------ | ---------------------------------------------------------- |
| Section title                        | SectionHeader                                    | `sm` / strong; text and optional count, no decorative icon |
| Input label                          | Input label                                      | `sm` / medium                                              |
| Compact media label                  | ImagePreviewHeader                               | `xs` / medium                                              |
| Help, empty state and media geometry | SupportingText                                   | `xs` / secondary or muted                                  |
| Compact media placeholder icon       | UploadPlaceholder compact                        | `chrome-icon-size` (16px)                                  |
| Gap between settings sections        | DocumentEditorPanels, nested section groups      | `xl` on mobile                                             |
| Gap within a section                 | LayoutStack                                      | `md`; labels to controls use `xxs`                         |
| Mobile content edge                  | Application gutter, SectionCard responsive inset | one `md` gutter                                            |

Supporting copy uses Core `SupportingText`: `xs` (12px), regular weight at every viewport.
This role covers product explanations, input help, empty collections, loading/save/sync feedback
and passive status messages. `size`, `weight`, CSS and arbitrary color overrides are rejected by
the public type and projected out at runtime. Semantic tone, native status/alert meaning and
live-region attributes remain available. Core PageHeader, SectionHeader, Field/Input help,
DataTable empty/selection copy, PageLoader, UploadPlaceholder and notifications own these rules;
Features consume the same role for domain messages.
Input values, item labels, table record data and commands retain their control/body roles.
Authored prose, captions, form-step introductions and whole-page error/recovery explanations
keep their content roles rather than inheriting the compact helper scale. Alert notices and
confirmation questions retain their primary message role; their secondary helper copy uses `xs`.

Core MediaPreviewGrid retains two equal columns at every width for OG/featured-image comparisons.
ImagePreviewHeader uses the compact-media `xs`/medium text role and reserves the same `xs` control-height
row with and without actions. Social-card geometry is owned by `lib/constants/og-image.ts`: 1200×630
(approximately 1.91:1). Featured-image cropping, OG rendering and metadata consume that contract.
Their previews keep the same ratio at every viewport width, without a minimum-height override.

Core ImageCropper uses ContentModal's closed `bodyLayout="fit"` contract: the header, help,
status and actions share the viewport budget with a shrinking media stage. The complete image
fits both stage dimensions while preserving its ratio; selection handles and focus outlines
retain space outside the image using existing `xl` spacing. No crop-specific tokens or Feature
style overrides are required. Artist images, site logos and ImageUploadCropField consume this
same owner. Freeform, TallArtwork and PanoramicArtwork stories cover image geometry.

Legacy featured images use the same centered cover crop as the API OG worker; generated OG previews
show the complete canvas. The exact crop ratio remains 1200/630. Empty copy stays short in all
20 locales. Compact upload frames contain a 16px icon only. Social-card previews do not display
persistent geometry, replacement hints, or an information button below the frame. Crop geometry
and upload validation remain in the upload flow. Loading text and progress appear only while active.
These contracts are consumed by the Post/Page/Work editors and the other existing media-pair consumers.

### Headers, commands and menus

Translate the reference direction into behavior: Rams's usefulness and restraint mean that controls
serve the writing surface; norns separates immediate controls from deeper context; TX–6 repeats
compact control groups consistently. These are product rules, not permission to shrink every label
or imitate hardware. Preserve the document's reading scale and compact only the surrounding chrome.

| Role               | Owner                     | Composition                                                                           |
| ------------------ | ------------------------- | ------------------------------------------------------------------------------------- |
| Page identity      | PageHeader / EditorHeader | Heading and optional back control; no command-sized heading in a menu                 |
| Editor context     | EditorHeader              | Current status and active locale; details and choices in their own menus              |
| Immediate commands | ToolbarSurface            | Stable order, shared targets, direct activation; no lone overflow button on a new row |
| Contextual choices | DropdownMenu              | Labeled rows, selected marks, disabled feedback; dividers separate actual groups      |
| Secondary help     | Tooltip / Popover         | Full name or constraints without duplicating long copy in compact chrome              |

Mobile EditorHeader owns `HeaderDensityProvider` and the `xs` action row. Its title has one row;
status, locale and the right-aligned command toolbar share the next row. Status omits the repeated
collaboration suffix; locale uses its full locale code, retaining the source-aware full name in its
accessible label, tooltip and menu. Core Button uses `xxs` horizontal padding and internal gaps in
this compact header context, while the fine-pointer target remains `control-height-xs` (30px), raised to 44px for coarse input. Icon commands
retain names and focus/hover tooltips. Do not expand icon-only commands into long mobile labels or
wrap each context item onto a separate line. Post, Page and Work consume the same contract and
use an `xs` header-to-content gap on mobile. Tiptap retains its internal geometry.

ToolbarSurface owns three closed placements: `floating` has containment and shadow, `embedded`
has a separating rule, and `inline` adds no duplicate surface or padding inside a header. Placement
and control density are separate decisions: a header uses 30px fine-pointer targets and at least 44px coarse-pointer targets; the existing compact
formatting toolbar uses its own compact geometry. Arrow keys move between enabled commands;
Home/End select the first/last command and RTL reverses horizontal movement. Menu items retain
their own keyboard selection behavior and do not inherit the header's abbreviated content.

SectionHeader owns `sm`/strong section titles. Pass textual content through it rather than nesting
Text with its default document size. ImagePreviewHeader owns `xs`/medium paired-media labels;
help and geometry remain `xs`. Never fix narrow layouts with a second independent font scale,
arbitrary icon dimensions, stronger fills or hidden mandatory actions. Validate actual narrow,
wide, translated and dark previews as well as closed props and token checks.

Tabs use neutral active lines, badges retain authored case with square edges and medium weight,
and menus use a thin border and restrained shadow. Menu keyboard-active rows and selected marks
remain visible. Input error underlines retain the danger role alongside the neutral focus treatment.

## Working on the system

Start with the [getting started guide](./design-system/getting-started.md).
The [contribution model](./design-system/contribution.md) defines proposals, acceptance, review roles and compatibility.
Verify source changes with the affected tests and CI checks.

1. Find the production owner and consumers in the component index before adding a component.
2. Reuse or add a role in the token source. Add a role to both themes with the same meaning; use an
   invariant role only when it truly should ignore theme selection.
3. Generate the CSS and source inventory with `pnpm design-system:generate`.
4. Put fixed component states next to their Core/Feature owner. Put actual local interaction
   adapters in `stories/shared` and the appropriate composition/page story; do not call services or copy a production screen into a fixture.
5. Run `pnpm design-system:check`, `pnpm design-system:test`, application checks and the preview
   checks listed in the Storybook guide. CI runs freshness, enforcement, packaging and preview typing.

Direct Node alternatives are available when a local package-manager launcher is unavailable:

```sh
node scripts/design-system/validate.mjs --generate
node scripts/design-system/validate.mjs
node --test scripts/design-system/*.test.mjs
```

The generator emits deterministic output. The reviewed token baseline is empty; new occurrences
fail. Unknown tokens
and parse errors cannot receive allowances. `--prune-baseline` removes obsolete allowances without
approving additions. Review any deliberate baseline edit; never regenerate it just to silence a
new violation. The audit states the exact scope of CSS spacing enforcement and the numeric
TypeScript layout props that it does not yet enforce.

The Storybook preview owns locale, direction, locale fonts, time zone and color scheme in one
provider stack. Stories may not pin toolbar globals, nest locale/theme providers, or supply a
literal UI locale. The design-system check enforces these rules for story sources and adapters.
Preview adapters resolve translated labels from the application's message catalogs; production
Core and Feature UI continue to receive labels through props. Story adapters are excluded from the
application TypeScript scope and checked together by the separate preview configuration.
Sample names, URLs, documents, code and catalog identifiers retain their authored values.

### Storybook accessibility checks

The [accessibility release readiness matrix](./design-system/release-readiness.md)
orders the site-wide Core, page, branch and feature review while preserving current visual
design and displayed wording. Source/story mappings and completed accessibility checks
are separate; native VoiceOver/Orca verification is a later integration step.

`@storybook/addon-a11y` scans each visited story with axe-core. Open the **Accessibility**
panel to inspect violations, passes and incomplete checks. The preview checks WCAG 2.0/2.1
A and AA, WCAG 2.2 AA and axe best practices. Its `body` context includes portaled menus and
dialogs. The addon's default component-level exclusion of the `region` rule remains in place.
Repeat checks with the Theme and Locale toolbar settings, including dark mode and RTL.

Build with `pnpm storybook:build`, then serve it with `pnpm storybook:preview` (port 6010).
In another terminal, run `pnpm storybook:test` to audit every story, including its play function;
violations fail the command. Use `--url <storybook-url>` to target a running development or
deployed catalog. Install the test browser once with `pnpm exec playwright install chromium`.
The Webpack-based framework uses the official Storybook test runner rather than the Vite-only
Vitest addon.

`pnpm storybook:test:a11y` runs the three `a11y-smoke` stories in
`stories/Accessibility.stories.tsx`. CI runs this representative subset, checking field labels,
disabled-control tab order, keyboard submission, menu arrow navigation and Escape, dialog
focus containment and restoration, and axe scans of the open menu/dialog portals. It does not
certify the entire catalog. The full command reports remaining violations across all stories.
These checks use the current preview defaults; other themes, locales and responsive states
still need separate review. Automated checks do not replace actual screen-reader testing or
judgment of label meaning and reading order. Do not disable rules globally to silence violations.

`pnpm design-system:test:contrast` checks both theme projections from `theme.test.ts`:
small text and status labels against supported surface states (4.5:1), filled-action text
in all tones and interaction states (4.5:1), meaningful control outlines and focus colors
(3:1), and every independent document text/highlight choice (4.5:1). CI runs this contract.
Outlined actions use `action-boundary`; input and PIN underlines use `border-strong`.
`border-default` remains a decorative separator and cannot identify an enabled input.
The default palette passing these checks does not validate arbitrary brand overrides,
photographic backgrounds, chart differentiation, or relying on color alone to convey state.

### Author accessibility acceptance

The product target is independent Author work with macOS VoiceOver and Linux Orca:
create a post, write and edit its content, upload files and audio recordings, request a
translation, inspect the result, and recover from errors. Purchase and product-download
flows are outside this implementation scope, as requested by the product owner.
WCAG 2.2 AA is the web UI development target. Use
[W3C WCAG2ICT](https://www.w3.org/WAI/standards-guidelines/wcag/non-web-ict/) for the
non-web parts of the packaged product; it is guidance rather than certification.

This is an authoring tool, so also evaluate [ATAG 2.0](https://www.w3.org/TR/ATAG20/):
Part A covers the author's interface and Part B covers support for producing accessible
content. UI operation and authored output are separate acceptance checks. In particular,
verify that alternative text, captions/transcripts, headings, table headers and content
language survive saving, translation, preview and publication. Applying these checks is
not a claim of complete ATAG conformance.

#### Page, state and scenario contracts

Accessibility is part of the production rendering and interaction contract. Each page
owner must establish the intended Author scenarios and the meaning of every relevant
state before treating a rule scan as acceptance. Core owns reusable control semantics;
Feature/Page owners supply contextual names, document structure, permissions, state
transitions and result announcements. These requirements apply to the visual interface
and assistive-technology interface together.

For each scenario define the initial permissions/data, user goal, reachable commands,
steps and observable result. For each step specify:

- the accessible name, role, value and state of the relevant controls, including
  selected/expanded/disabled/invalid/busy states and error/description relationships;
- the document's reading structure and meaningful order, including landmarks,
  headings, field groups, mixed document blocks and content language;
- the keyboard path and expected focus before/after an action, including dialog entry,
  confinement, cancellation, return to the invoking control and editor selection;
- which asynchronous transitions require a status/error announcement, its meaning
  and urgency, and whether focus should remain or move;
- the resulting content or operation and the available recovery action. Include
  loading, empty, unavailable, read-only, cancelled and failed states where applicable.

Reading order and keyboard focus order are separate expectations; neither is derived
automatically from CSS placement. Use native HTML semantics first and add ARIA for
missing meaning. An arbitrary nonempty label is insufficient: tests must assert the
intended contextual name and state. A role or label must not advertise an operation
that the current permissions/state cannot perform.

Automate these expectations in real view fixtures and transitions. Storybook `play`
steps name the user goal and check names, roles, states, DOM sequence and focus.
[Playwright ARIA snapshots](https://playwright.dev/docs/aria-snapshots) can compare
the browser's accessible structure with explicit, order-sensitive expected templates;
do not automatically bless generated snapshots as correct. Rule scans supplement
these scenario contracts. Browser semantic evidence does not itself prove the native
VoiceOver/Orca cursor or speech output; actual assistive-technology testing verifies
that final integration with a representative set of the same scenarios.

The current post stories implement the first bounded contracts: named title/body in
reading order, Back-to-title keyboard order, entering/writing/leaving/returning to the
editor without losing text, and a read-only heading/document that cannot masquerade
as editable fields. They use production translations for the selected UI locale while
asserting the Korean fixture's actual content language. Upload, translation and the
other Author tasks below still require their own production state/transition contracts;
these two fixtures do not establish complete page or Author workflow coverage.

#### Verification layers and supported environments

1. Run token contrast contracts, component interaction tests and Storybook axe checks
   continuously. Scan open dialogs, menus, errors and completed requests, not just the
   initial state. Axe's incomplete results require human review. Keyboard play tests and
   browser accessibility snapshots provide evidence about semantics and focus; neither
   exercises VoiceOver speech, its cursor or a native file chooser.
2. Run the Author tasks below with actual VoiceOver on a physical Mac. Use Safari as the
   web reference environment, then repeat in the exact packaged application's engine.
   Record the macOS, browser/webview and application build versions. A Safari pass does
   not establish a packaged application's pass. No desktop shell/build was identified
   in this repository during the initial review, so its native accessibility bridge is
   not yet verified. If an Electron shell is used, consult its
   [accessibility documentation](https://www.electronjs.org/docs/latest/tutorial/accessibility)
   and verify assistive-technology detection in that shell.
3. Run the same tasks with [Orca](https://orca.gnome.org/get-involved) on each supported
   Linux desktop/runtime combination. Record distribution, desktop session (Wayland/X11),
   toolkit/webview, Orca and app versions. Use native accessibility-event/debug logs to
   diagnose runtime-specific failures; do not extrapolate a macOS pass to Linux.
4. Include experienced blind screen-reader users in realistic Author task evaluation
   after fixing known blockers. Use different levels of experience; developer testing
   alone does not establish independent usability. Combine this with standards review,
   as recommended by [W3C user evaluation guidance](https://www.w3.org/WAI/test-evaluate/involving-users/).

[Apple's app testing guidance](https://developer.apple.com/documentation/accessibility/performing-accessibility-testing-for-your-app)
recommends deriving tests from the main tasks and completing them with actual assistive
technologies. For Mac sessions, use Command-F5 to toggle VoiceOver; the default VO modifier
is Control-Option. Test both Tab/Shift-Tab and VoiceOver navigation/interaction, including
the rotor, text navigation, selection and activation. Record Quick Nav, cursor tracking,
live-region and verbosity settings so a settings difference is reproducible. Do not
silently change a tester's preferences to obtain a pass. Check a screen-curtain/no-visual-
assistance run once the tester understands the controls.

Capture speech with the [VoiceOver caption panel](https://support.apple.com/en-kw/guide/voiceover/unac078/mac)
as well as the focused element and the resulting document. The caption panel complements
listening; it does not prove that text editing, cursor movement or task completion works.
Use test accounts and non-sensitive fixtures for recordings. Record pass, fail, not checked
or not applicable for each scenario, as in the
[DWP screen-reader testing method](https://accessibility-manual.dwp.gov.uk/best-practice/screen-reader-testing).

#### Required Author task records

Use a real Author account, including its actual permission boundaries, rather than an
administrator-only fixture. Start each task from navigation rather than placing focus on
its target programmatically. Success means the author completes the task without a mouse,
visual instructions or assistance and can independently identify the result.

| Task                           | Required evidence and failure conditions                                                                                                                                                                                                                                           |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Find and create a post         | Find creation from navigation/rotor, open it, identify title/body/status, and create a durable draft. Empty, loading and error states must be understandable.                                                                                                                      |
| Write and edit                 | Enter paragraphs, navigate by character/word/line, select and replace text, cut/copy/paste, undo/redo, save, leave and reopen. Read the saved result and confirm the insertion point and selection remain meaningful.                                                              |
| Format and structure           | Reach formatting and insert menus without pointer selection; identify pressed/current states; apply heading/list/link formatting, return to the same selection, and leave the editor without a trap. Read headings/lists/tables and verify mixed media controls remain reachable.  |
| Move or remove a block         | Use an explicit keyboard action instead of dragging, hear block identity and changed position, confirm/cancel removal, and recover focus to a predictable surviving block.                                                                                                         |
| Upload files and recordings    | Open the actual OS chooser, select and cancel, upload multiple files including audio, identify each filename and selection state, hear important progress transitions, and confirm insertion at the intended document position. A drop zone alone is insufficient.                 |
| Recover from upload problems   | Reject unsupported/oversized files; cancel, retry after network/processing failure, and reselect the same file. Distinguish uploading, processing, attached and failed; retain surrounding text and insertion position.                                                            |
| Inspect audio                  | Identify the recording, play/pause, seek via keyboard, change volume and reach duration/time information. Avoid autoplay and repeated time/progress announcements that drown out navigation. Verify descriptive text/transcript editing and its saved output.                      |
| Request and review translation | Choose a named target language, identify eligibility/cost or unavailable state, submit as Author, distinguish queued/running/completed/failed/cancelled, retry or cancel, open the result and edit it. Completion must not unexpectedly move focus or overwrite newer local edits. |
| Switch language and preview    | Name the active/source language; use the authored language for pronunciation, preserving the UI language on controls. Confirm missing-target/read-only states cannot masquerade as an editable document. Inspect saved/translated alternative text and structure.                  |
| Save, publish and recover      | Distinguish local changes from durable save; confirm the required transition, close/cancel dialogs and restore focus. Reopen after reconnect; explain permission loss/session expiry and preserve recoverable work.                                                                |
| Work collaboratively           | Remote edits must not steal focus/selection or announce every keystroke. Identify relevant conflicts/save failures and recover without destroying another author's content.                                                                                                        |

Repeat essential tasks in light/dark, Korean/English and an RTL locale, narrow windows,
text enlargement/zoom, increased contrast and reduced motion. Review custom map/canvas/
waveform controls separately: pixels and a single generic canvas name do not expose their
editable data or commands. Prefer existing platform semantics; do not apply a global
`role="application"` or suppress screen-reader shortcuts to make keyboard tests pass.

For every record store: task ID; role/permissions; fixture; exact app/OS/AT versions;
locale/theme and VoiceOver settings; navigation steps; expected and heard speech;
keyboard and VoiceOver-cursor focus before/after; saved result; status; issue/reference;
and tester/date. An untested scenario remains **not checked**, never an assumed pass.
Block Author release acceptance on task blockers, data loss, traps, unreadable actions,
inaccessible native dialogs or unannounced failures. Informative wording improvements can
be tracked separately after independent task completion is established.

#### Initial automated evidence (2026-10-11)

The first static catalog audit ran 1,148 tests: 995 passed and 153 failed. Failures include
axe violations and story/runtime failures; they are not 153 distinct product defects.
The per-test starting inventory is [accessibility-initial-audit.json](./design-system/accessibility-initial-audit.json).
It used the current preview defaults and predates the subsequent Author fixes. The result
must not be represented as a current all-pass report or a VoiceOver test.

The follow-up changes make Core selection-grid names required, name the document title
field, give the collaboration icon a valid semantic role, and expose named multiline
editing surfaces with their authored room language. Read-only surfaces expose a document
rather than an editable textbox. Real consumers are the post body and artist/label/release
compact fields, plus File Manager and the editor library picker. The
`Pages/Editors/Post/Keyboard Authoring` and `Read Only` stories check the bounded
semantic and scenario contracts above in the local collaborative fixture.
Run it with `pnpm storybook:test:author`; CI runs this check alongside the Core smoke stories.
These are partial regression checks; native VoiceOver/Orca and server-backed Author task
records are **not checked** until performed and recorded.

## Coverage and completion

The source inventory indexes every current Core/Feature component candidate, all feature domains
and all page entrypoints. Component candidates, tests, fixed stories and real interactive page
adapters are different kinds of evidence. The [route coverage matrix](./design-system/route-preview-coverage.md)
labels each route's actual adapter, component-only coverage or missing composition. Redirect-only
and development-only entries are not counted as complete product screens.

The kit contains reusable controls and compositions plus real route-owned profile/security/
newsletter, verification, public Series and Share password views. Authentication, authorization,
server loading, collaboration, delivery and persistence remain product/controller concerns.
Remaining controller-heavy screens require a production view boundary before they can receive an
honest page adapter; the coverage matrix is the expansion backlog. Ownership checks and the generated token report state their source scope; they do not certify
every visual state or authored geometry.

## File browser selection and responsive presentation

See the [file browser implementation guide](./design-system/file-browser.md) for sizing, interaction, authorization and verification contracts.

`Display/FileTypeIcon` uses finite `inline`, `compact` and `preview` sizes and owns MIME type icons consumed by media previews and both file browser views.
`SelectionSurface` provides visible checkbox controls through `selectionStyle="checkbox"` and the
`selectionControl` slot. Highlight selection remains the default for existing consumers.
`SelectionToolbar` delegates geometry to the same Core `ToolbarLayout` as DataTable toolbars. File Manager and Editor File Library Picker share `FileBrowserListView` and Core `DataTableView.mobileLayout="inline"`: vertically centered one-line rows, trailing short format/size, filename ellipsis, and size-only metadata below the container `sm` breakpoint.
The library picker confirms single file activation immediately; multiple selection uses Finder-style highlights in grids, checkboxes in lists
and an explicit Add action. File grids have no checkbox or checkmark badge. Storybook's single and multiple form examples add file IDs to form data
and show the selection and submitted files only on confirmation.

`SelectionPath` treats the first supplied segment as the accessible root. With `parentLabel`, it
shows a parent-folder action only when at least two accessible segments exist; a scoped root has
neither a parent action nor hidden ancestor links. Controllers must supply only authorized paths. The parent action uses the curved CornerLeftUp glyph and the same Core IconButton size and density as the view controls.
Below the small viewport or toolbar-container breakpoint, paths display only the current folder name and authorized up action, preserving the full authorized path in the navigation title.
The current API has a shared folder hierarchy: `File.List` requires author access, while folder
creation, rename, move and deletion require `File.ManageLibrary` (admin). There is currently no
folder-specific ACL or role-specific root in `ListFileManagerItems`; UI must not invent one.

Both file browser presentations consume `useFileManagerSelection`: ordinary row/tile clicks replace
selection, Ctrl/Cmd toggles one item, Shift selects a range from the last anchor, and Ctrl/Cmd+Shift
adds that range. Checkboxes toggle individually and Shift-click supports ranges. Mouse marquee
selection starts in empty space; Ctrl/Cmd/Shift keeps prior selections. Touch scrolling remains native, and taps toggle eligible files in multiple selection contexts. Folders participate in browser highlight selection, while Add consumes only eligible files. Incompatible files remain excluded; selection alone never submits. Folder click/Space selects; double click/Enter opens it in grid and list. `DataTableView.selection.onRowSelectionClick` exposes the
checkbox click modifiers for domain-owned range policy without leaking styling into consumers.

Workspace grids adapt to their `SelectionViewport` container. Below the shared small breakpoint,
automatic columns distribute remaining width equally with a 4.75rem minimum and `xs` gaps; narrow containers
also use compact file labels and icons. This prevents fixed-width columns from leaving unused
space on mobile and desktop auto grids also distribute width using `1fr`. Explicit `columns` values reuse the
finite Core Layout count and responsive breakpoint contract; all responsive counts measure the
selection container. See the guide for sparse-row behavior and examples.

File browser view options use the Core Selection Surface file appearance, finite icon sizes and grid spacing. The shared settings popover uses Core NativeRange sliders with localized current-value text and is consumed by File Manager and Editor File Library Picker; consent-gated local persistence is specified in [the file browser guide](./design-system/file-browser.md).

### Shared translation rows

EntityTranslationsPanel uses TranslationLocaleRow across all entity editors. Rows align to the
section edge without an additional nested card inset. Language names use `sm`/medium; codes,
presence badges and optional helper copy use `xs`. Existing translations without a timestamp do
not show a missing-document message. The source locale is represented once, by the source selector, rather than repeated in the target list.
Field `layout="inline"` owns a label/control row and a full-width helper/error track using the same
typography tokens at every width. NativeSelect owns its trailing dropdown indicator and accessory slots.

Core ToolbarCommand owns `xs` targets and the closed `label`, `icon`, and `responsive` presentations.
Responsive commands show icons only on narrow fine-pointer viewports; touch input keeps labels. Both retain their full accessible names and tooltips.
Translation management uses icon commands at every width so command order and targets stay identical.
Translation commands stay together at the right of their row; the common editor header uses the
same command component. Feature owns translated labels, permission checks and command behavior.

TranslationPanelSectionCard uses SectionHeader `descriptionPlacement="below-row"`: the title and
compact command group share a row, while helper copy uses the full next track. Long helper copy
cannot push the commands onto another mobile row. The grouped-copy default remains available
for existing section compositions.

ShareLinkSectionView consumes SectionHeader's text heading and `below-row` helper placement.
Its empty list message uses the existing `xs`/secondary helper role at all viewport sizes; a
normal empty list is not promoted to a body-sized heading. Action icons remain on their controls.

### Language code display

Core Typography `LocaleCode` owns visible language-code metadata: `xs`/regular, secondary tone,
nonwrapping left-to-right text. When a code adds needed context, render its language name separately;
`English EN` uses a `sm` name and the shared code component. Entity translation rows and their
source-language options use language names without duplicate codes; source identity remains explicit.
`formatLocaleCode` provides the same notation for applicable native options,
compact buttons and translated sentence interpolations: `EN`, `KO`, `ZH-CN`, `PT-BR` and
`ZH-HANT-TW`. Display aliases replace underscores with hyphens and preserve region/script subtags.
No new type scale or Feature CSS is needed.

This uppercase notation is a product display convention, not the canonical casing of stored
language tags. Locale matching, option values, callbacks, API payloads, persisted values, `lang`
and `hreflang` retain their existing domain values. Source-option formatting strips only a matching
trailing language-code suffix; meaningful language-name qualifiers such as `Português (Brasil)`
remain intact. Public/editor language menus, translation administration, version history and
original-language notice actions retain their scoped code presentation. See the
[translation identity contract](./design-system/translation-identity-history-contract.md).

### Compact local settings

Core Popover `size="compact"` is a 15rem surface capped to the viewport, for brief local settings and supporting information. Pair it with `Popover.Dropdown padding="compact"` and xxs composition gaps when content is dense. Label/value pairs may use xs text; retain the Core slider interaction height. File browser View Settings is the real consumer and the Popover Compact story documents the surface. Longer forms use standard or wide surfaces.

Repeated Feature patterns have Core owners: `EmptyState` for empty collections and results,
`CopyButton` for copy-to-clipboard commands, `SearchInput` for search fields, `StatusIcon` for
status-toned glyphs, Avatar `name` for initials, StatCard `icon`/`href` for linked metrics,
`Pagination getHref` for link pagination, `useSortableItem` for reorder rows, `BlockSelectionTarget`
for editor block selection and `InputFrame` for hosted editable surfaces. Features must not rebuild
these with local CSS or direct framework imports. The framework ownership check rejects native
`button`, `input` (except `type="hidden"`), `select`, `textarea` and `role="button"` outside Core;
`nativeControlOwners` in `scripts/design-system/framework-policy.mjs` names the remaining reviewed exceptions.

Collection and table controls share Core `ToolbarLayout`; `SelectionToolbar` and both DataTable toolbar adapters consume it. Search/filter inputs inherit compact density. Table selection geometry is Core-owned. See [tables and toolbars](./design-system/tables-and-toolbars.md).

### Local backups in account settings

`/my/settings` places `features/my/LocalBackups` immediately after the page heading. The section
belongs with account preferences because journals belong to the signed-in member on this device;
the empty state also makes retention and recovery discoverable. `LocalBackupsView` composes Core
SectionCard, Layout, Heading/Text/LocaleCode, EmptyState, Alert and Button. Final discard uses the
shared ConfirmationDialog's danger/strong treatment and Core DialogActions. No Core contract,
token, custom styling or new control variant is introduced.

`Feature/My/Local Backups` covers empty, several entries, confirmation/discard, failed lookup,
unavailable storage and phone states. Use the locale/theme toolbar for Korean and dark inspection.
`Pages/Account/Full Pages/Settings With Local
Backups` places the same production View in the complete settings page. Fixtures replace storage
and navigation; they never replay or delete real journals. The browser owner uses existing Web Locks
and rechecks the member/owner before deletion. Editor navigation retains the journal locale and
leaves adoption/replay to each room's existing claimOrphans path.

The coordinated local-backup/download-policy change is uncommitted. Its validation logs and
screenshot plan live in `.artifacts/design-system/reviews/local-backups/`. Storybook, production
visual inspection and the Notion Local Backups reference could not be inspected in the restricted
execution environment; this is pending visual review, not design approval.
