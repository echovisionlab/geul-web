# Geul design system changelog

This record describes design system changes in the repository.
The system is managed with the application source and has no separate package release.
The current application package version is `0.11.2`; that value alone does not establish deployment of the changes below.
Git changes and application release records identify deployment.

## 2026-10-14 · Durable editor save state

- Core `EditorHeaderProps` adds `saveState: saved | saving | offline | error | reload` (optional for transport-only consumers). Core `CollabSyncStatusIndicator` adds a mutually exclusive `state` input and retains its required `label`, tooltip and fixed token size. No new visual tokens or layout variants.
- Migration: block-room consumers use the authoring header, which supplies the durable model automatically from the runtime entity and save registry. Direct Core consumers pass `saveState` and matching `labels.syncStatus`; direct indicators pass `state` and `label`. Legacy `isConnected`/`isSynced` remains available for document rooms without durable ACKs and must not be mixed with indicator `state`.
- `saved` requires no unacknowledged local edits; reconnect synchronization is `saving`, local offline editing is `offline`, persistence retry is `error`, and a canonical rebuild is `reload`. Core stories cover each state; labels originate in English with English fallbacks in translation bundles.
- Verification: targeted automated coverage covers state priority, durable ACK/delete coverage, retry feedback, journal recovery and ownership, and retained editor sessions. Browser visual verification remains pending where Storybook cannot bind a local port. The existing Post screenshot was inspected for header geometry; it is not evidence for the changed stories.

## 2026-10-13 · Korean line breaking and review fixes

- **Korean breaks lines at spaces.** `:lang(ko) { word-break: keep-all; overflow-wrap: anywhere }` in `base.css`: words (eojeol) no longer split at line ends in documents or UI; Japanese and Chinese keep breaking between characters; over-long words still wrap.
- Published list items render their nested blocks inside the `<li>` again (`PublicDocumentChildren`), so child lists belong to their item for assistive technology; numbered items carry `<ol start>`. Geometry is unchanged (`.prose li > [data-document-children]` offsets the list indent; editor and published nested step both 16px).
- Materialized `.prose` HTML: the generic block pair uses `:where()` on its second compound, so heading pairs win (24px above, 8px below a heading; was 12/12 when a `.check-list-item` raised the generic rule's specificity).
- Core `Heading` with an `id` sets `scroll-margin-top: var(--geul-chrome-scroll-offset)`: outline and fragment targets outside `.prose` (changelog releases and groups) land below the fixed header.
- Core Input declares `sm` size variables, so an explicit `size="sm"` choice inside an `xs` group or `InputSizeProvider` region does not inherit `xs`.
- A list item with children keeps its authored text color on the `<li>` (and marker); its background and alignment sit on `[data-list-item-content]`, so nested blocks no longer inherit them (`PublicListItem`). A published list block's own list sits flush in its block (the materialized-HTML `ul ul` margin no longer adds 8px per level).
- The editor applies an explicit numbered-list `start` (`counter-set` on the item), matching the published numbering.
- `[lang]:not(:lang(ko))` restores `word-break: normal`, so other-language content inside Korean UI breaks by its own rules.
- Editor callout geometry (icon, border, padding, child indent) keys on the content element (`data-content-kind`); the reorder gutter wrapper had broken the `.container > .content` path, so editor callouts showed no icon or frame.
- Post and Page editors: the OG image grid and Options sit in the same `SectionCard` inset as URL, translations, summary and metadata (left edges were 12px apart).
- Found by Codex (gpt-6-astra, high) reviews of this round.

## 2026-10-13 · Wide, open reading: 44rem measure, 1.7 leading, 12px block rhythm

- **`contentWidth.reading` is 44rem (704px, was 36rem), one width for every language and script** (owner decision: wide and open; no per-language widths). Consumers follow without changes: `LayoutContainer size="reading"`, `.prose[data-reading-measure]` (posts, legal, work, event), `ContentChrome measure="reading"`, the post hero title padding and the outline's reserved space. Measured at 16px Noto Sans, spaces included: 92 Latin, 60 Hangul and 120 Arabic characters per full line (were 71–75, 48–49 and 95–98). Breakouts are unchanged (tables, code, Mermaid → `standard`; media, maps, executable scenes → `wide`; bounded by the document box beside the column).
- **The outline column stays at `lg` with a balanced reserve.** Body → column clearance: 1280px 36px, 1440px 116px, 1920px 168px (rail at 1024px: 120px); the body stays centered under the title. Between 1200 and 1255px the measure is bounded by the document box (648–703px) and cannot reach the column. `assertOutlineClearance` in the document plays asserts it. Contract: [table of contents](table-of-contents.md#presentations-2026-10-13-owner-decision).
- **New token `line-height-document` (1.7 on screen, 1.6 on paper).** Running text in document bodies uses it, one value for every script: published `.prose` paragraphs, lists and markers, quotes, callout copy and check-list items, the same Tiptap editor blocks, and Core `List leading="document"` (new prop; the changelog's release notes). Interface text keeps `line-height-xs`–`xl`, tables keep `md`, headings keep `heading-line-height`. Paper is 1.6 at 10.5pt: tighter than the screen, above the dense 1.5, because the A4 line is long (about 95 Latin characters) and Hangul fills the em box. The Korean post still prints on 7 A4 pages.
- **Block rhythm:** blocks are `md` (12px) apart (paragraph → paragraph, paragraph ↔ quote, callout, list, media, table, code; was 8px). Items of one list stay `xs` (8px). A heading after content opens `xl` (24px, was `lg` 16px) above and keeps `xs` below: with a 12px block gap, 16px would leave headings almost equidistant between sections, so `xl` restores the 2:1 grouping. The same totals hold for published blocks, materialized HTML (list items of one `ul`/`ol` now `xs` apart, were 0), nested children, callout content and the Tiptap block group (flex gap `xs` + margins): 300 editor ↔ published gaps measured equal at 390/834/1440 (`typography-audit.mjs gaps`), asserted by the `Feature/Editor/Public Block Comparison` plays.
- **A Core `Heading` inside `.prose` keeps its role.** The `.prose` heading element fallbacks (HTML without `data-heading-level`) are `.prose :where(hN:not([data-heading-level]))`, class-level specificity, so Core's role wins: the legal editor preview title renders `heading-title` (40px from `sm`, was 34px as body `h1`), like the published legal page. Migration: CSS that relied on the fallback restyling a Core `Heading` uses the Core scale instead.
- **Rolled back: the CMS page section `reading` width.** `PageSectionMaxWidth` is `full | container | narrow` again; `PAGE_SECTION_READING_WIDTH_AVAILABLE`, the `READING` wire probe, `getPageSectionClassName`, `features/page/section-style.module.css`, the settings option, its translations, the zod golden values and the `PageReadingSections` story are removed. `narrow` (800px) serves bounded text sections and the wire contract is unchanged. The section settings field still shows `full` for an unset width. The section settings popover's trigger no longer toggles it closed on the same click.
- Fixtures and tooling: the long-document stories (posts, pages, terms, work, event) author their body in the Storybook locale for `ko` (Hangul) and `ar` (Arabic, RTL), otherwise English. `typography-audit.mjs measure` records the reading measure (characters per line), block gaps and outline clearance; the new `gaps` command pairs editor/published gaps by block id ([review tools](review-tools.md#typography-role-audit)). Contract: [token contract](token-contract.md#document-leading-and-block-rhythm).

## 2026-10-13 · One h1 per document: authored headings below the title

- **Published authored headings render one level below the document title, at their authored size.** Authored H1 → `h2`, H2 → `h3`, H3 → `h4` (capped at `h6`), so the title (`Heading scale="title"`) is the page's only `h1` and the outline has no skipped levels. Previously a post or page with authored H1 rendered up to nine `h1`s beside the title. Untitled bodies keep the authored element (offset 0): an untitled CMS page's H1 is its `h1`. Resolves the open heading-semantics decision of the outline-layout entry below.
- **New `DocumentHeadingScope` / `useDocumentHeadingParentLevel` / `documentHeadingTag`** (`@/features/document-layout`). `ContentLayoutView` declares `parentLevel` 1 for its body when it has chrome (Post, Page with a visible title, Terms/Privacy and history/share, Work, Event; the changelog has no authored body) and 0 without. Release, Label and Artist descriptions declare 2 (below their level-2 section label); the legal editor preview declares 1, and `policyTiptapDocumentToHtml` gains `{ headingParentLevel }` for its HTML preview. Consumers: `GeneratedRichTextBlockView` and `DefaultBlockView` (`HeadingBlock`).
- **Published headings carry `data-heading-level` (the authored level); `.prose` heading sizes key on it** with element-only fallbacks for HTML without the attribute (`lib/styles/document-content.css`). Migration: CSS or tests that select body headings by element (`.prose h1`) select `.prose [data-heading-level="1"]`. Ids, anchors, the table of contents (authored levels; `buildHtmlTocDocument` reads the attribute), the scroll spy and Markdown export (`#` per authored level) are unchanged.
- Measured identical before and after (`typography-audit compare`): 546 screen headings in 20 stories at 390/834/1440 and 184 A4 print headings — size, line height, weight, box height and width. All 45 full-page captures (screen and print media) are byte-identical and five A4 PDFs rasterize identically.
- Fixtures: the long documents author H1–H3 again (`NESTED_LONG_SECTIONS`, legal sections numbered 1 / 1.1 / 2.1.1); `UNTITLED_LONG_SECTIONS` opens with one authored H1. Plays (`assertDocumentOutline`) assert one `h1` and no skipped level on `Pages/Public/Documents` long/hero/reading/untitled/hierarchy, `Pages/Legal/Public Document` TermsLongDocument and `Pages/Public/Entity Detail` Work/EventLongDocument; the hierarchy plays select by authored level and assert `h2`–`h4`. Tooling: `typography-audit.mjs` records every body heading and the page outline, gains `--out` and `compare`. Contract: [authored heading semantics](token-contract.md#authored-heading-semantics).

## 2026-10-13 · One outline layout for every document

- **Breaking: `TableOfContentsView` has no standalone fixed rail.** `children` (the document) is required and `footerSelector` is removed; Core always reserves the outline beside the document (column from `lg`, rail below, phone scrubbing). Migration: pass the document as children and pick `contentPlacement` — `center` for running text on the reading measure, `start` for section-composed CMS pages. The Feature `TableOfContents` follows the same props.
- **Migrated consumers:** legal documents (terms/privacy current and scheduled preview, history detail, share link) through the new `LegalDocumentLayout`, the changelog, and work and event details now read like posts: `ContentLayoutView` + `ContentChrome measure="reading"` header, `.prose[data-reading-measure]` body (changelog: `LayoutContainer size="reading"`), `center` outline. Header order and content are unchanged; the header → body gap is the shared `md`. Work featured-image and event poster headers keep their full-width grids. These pages previously ran text across the whole viewport with a fixed rail over it from `md` and no outline on phones. The legal editor preview renders the body without an outline.
- **New `tableOfContentsScope` (Core) and `ContentChrome measure: 'full' | 'reading'`.** `ContentLayoutView` carries the scope; inside it the Core-private `--_table-of-contents-inset-start`/`-end` hold the outline's reserved inline space (0 without an outline and on paper). Reading chrome, the post hero title and document controls consume them, so a content-language menu ends before the outline column (it overlapped the column label on untitled pages) and hero/plain titles share the first body line's start edge at every width (14–22px drift at 640–767px before).
- **The outline fits the first screen.** The column and the revealed list subtract the distance still to scroll before they stick, so their bottom no longer runs off the viewport below a title or hero; they keep their own scroll.
- **Nested outline UX:** the outline precedes the document in reading and focus order; column rows meet the 44px minimum on coarse pointers (tablets reach `lg`); titles keep their authored direction in a `<bdi>` isolate while rows keep the interface alignment; while scrubbing, the highlighted row is scrolled level with the finger instead of collecting at the list's lower edge.
- **`LayoutContainer size="reading"` is a screen measure:** it drops its maximum on paper, matching the post reading column. `PostViewContent` uses it (and `ContentChrome measure="reading"`) instead of its own reading-column CSS.
- **CMS page sections gain a `reading` width** (schema, renderer, editor labels in all locales; `features/page/section-style.module.css`): the reading measure bounds the section's text box, the section centers like `container`/`narrow`, screen only. Existing values and the `full` default are unchanged. The editor offers it once the installed wire contract carries `PageSectionSettings.MaxWidth.MAX_WIDTH_READING` (`PAGE_SECTION_READING_WIDTH_AVAILABLE`); geul-proto 0.5.0 does not yet, and the API decodes page documents strictly. The section settings field now shows `full` for an unset width (what the renderer draws) instead of `container`.
- Open decision: authored Heading 1 in published rich text renders `h1` next to the document title (`Heading scale="title"`, the intended single h1). Demoting published authored headings one semantic level (visual size kept) is recommended but changes rendered markup, document CSS selectors and print rules owned by the type scale; it is not part of this change. Review fixtures now author sections from level 2 without skips.
- Stories: `Pages/Public/Documents` PostHeroLongDocument, PageLongDocumentUntitled, PageReadingSections; `Pages/Legal/Public Document` TermsLongDocument; `Pages/Public/Utilities` ChangelogLongDocument; `Pages/Public/Entity Detail` WorkLongDocument, EventLongDocument. Core TableOfContents examples all render the reserved layout (Narrow removed). Tooling: `story-screenshot-compare.mjs` gains `scroll`, `tab`, `move`, `drag` (mouse or real touch points), `touch` and `measure` (bounding boxes into `summary.json`). Contract: [table of contents](table-of-contents.md).

## 2026-10-13 · No text below 12px

- **`chrome-section-font-size` is 12px (`font-size-xs`, was 10px).** SideNavigation section labels and DropdownMenu group labels read at the chrome text size; 10px was hard to read in Hangul, Kana and Han and was the only step below the type scale.
- New token `letter-spacing-caps` (0.04em). Uppercase labels (SideNavigation sections, Core `Text casing="uppercase"`, the block comparison headings) separate from running text by tracking and weight instead of a smaller size.
- SideNavigation shares one leading edge: section labels, top-level and section item icons all start at `xs` 8px (were 8, 12 and 2px). Section labels are medium weight like DropdownMenu group labels. Without icons, section children still step in by one hierarchy step.
- **LabelBadge/StatusBadge `size="xs"` is removed.** At 12px it would equal the default `sm`. Migration: drop `size="xs"` (17 consumers updated: admin lists, menus, sessions, share links, translations, artist credits, file download status, places, map themes, account role).

## 2026-10-13 · Type scale, document title and paper typography

- **New heading role `heading-title` and Core `Heading scale="title"`** (`HeadingScale` gains `'title'`): 32px below `sm`, 40px from `sm`, 22pt on paper. Post (plain and hero), Page chrome and public document details (Work, Event, Release, Artist, Label, Terms/Privacy and their history detail, shared legal documents, Changelog) and the legal editor title preview use it. Before, the title was 26px on phones under a 34px authored body `h1` (inverted), equal to body `h1` on desktop, and Work/Event/legal titles were 26px at every width.
- **Heading tokens are responsive in the token layer** (`responsiveTokens.sm`, generated media block): `h1` 28/34px, `h2` 24/26px, `h3` 20/22px (was 34/26/22px at every width); `h4`–`h6` unchanged (18/16/14px). Core Heading, `.prose` and the Tiptap editor read the same role at each width, so the editor stays WYSIWYG. Interface headings on scale 1–3 shrink by 2–6px on phones with the documents; one scale, no per-consumer breakpoints.
- **Paper typography from tokens** (`printTokens`, generated after the responsive blocks): body 10.5pt (was 12pt: `print.css` set 11pt on `body` but `.prose` used the 16px role), `sm` 9pt for code, tables and captions, `xs` 8pt, headings title 22 > h1 18 > h2 15.5 > h3 13.5pt (was title 16pt = body `h1` 16pt, h2 14pt, h3 12pt = body), running-text line height 1.5. `print.css` no longer sets literal sizes; code-block print title/language, print code source (was 8.5pt) and shader filenames consume the roles. Hyphenation, orphans/widows 3 and URL wrapping for running text; `break-inside: avoid` for figures, images, quotes, callouts, math, Mermaid and code blocks; captions stay with their figure; tables paginate by row with the repeated header row. Page margins 15mm × 18mm (was 12mm): about 95 Latin characters per 10.5pt line on A4 (12mm would exceed 100). Every theme still prints the light roles.
- **`DOCUMENT_TITLE_SCALE` is removed** from `@/features/document-layout`. Migration: replace `scale={DOCUMENT_TITLE_SCALE}` with `scale="title"`; CSS that mirrored the title line box uses `var(--geul-heading-title)` without a breakpoint (PostHeader title actions).
- **Literal type sizes are enforced** (`raw-font-size`, empty baseline): `font-size`/`line-height`/`font` literals in any unit (px, rem, em, pt, %, viewport units, keywords, unitless line height) on screen and in print rules, and TS style/option objects, DOM style and canvas `font` assignments. `print.css` lost its exemption; `authoredTypographyFiles` names only share-image artwork, the immersive scene title artwork and the error-code particle canvas. Fixed in the process: the collaboration caret label (11px → `xs`) and the immersive scene credits (0.9vw clamp → `xs`, `sm` from `xl`).
- **One size per role across features** (55 files): panel/load errors `sm`; Alert bodies no longer shrunk to `xs`; centered state descriptions `sm` (Forms access/submission, restricted page, MCP consent, login status; were 16–18px); confirmation messages `md` and dialog detail lines `sm`; status lines `SupportingText`; hand-rolled section titles `sm` strong; editor media/map captions `xs` muted like the published caption; Release track rows and editor credit tables `sm`; settings section headings `scale={4}`; auth/account card titles `scale={2}` (was 3, 2 or `{ base: 3, sm: 2 }`).
- Tooling: `node scripts/design-system/typography-audit.mjs static|measure` ([review tools](review-tools.md#typography-role-audit)). Stories: `Pages/Public/Documents` PostHeadingHierarchy, PostHeadingHierarchyPhone, PageHeadingHierarchy (plays assert title ≥ 1.125 × h1 > h2 > h3 > body); Foundations/Typography shows base, `sm` and paper sizes. Contract: [token contract](token-contract.md#type-scale-document-title-and-paper).
- **Headings group with the text they introduce.** A heading after other content opens `lg` (16px) above it and keeps the `xs` (8px) block rhythm below, in published blocks, materialized HTML, nested children and the Tiptap block group alike (measured equal in editor and published view at 390 and 1440, and on paper). Previously every block, headings included, was 8px apart.

## 2026-10-13 · Reading measure and outline presentations

- **New token `contentWidth.reading` (36rem, `--geul-content-width-reading`) and `LayoutContainer size="reading"`.** Posts no longer span the viewport: running text, the plain header, series and comments share one centered reading column (about 77 Latin characters); the hero image stays full width and its title is padded onto the same column. Full-width tables, code and Mermaid blocks may extend to `standard`; full-width images, video, external video, maps and executable scenes to `wide`. Narrower authored blocks, audio and attachments stay at the measure. Screen only; print is unchanged. CMS page sections keep their own widths.
- **TableOfContentsView gains `children` and `contentPlacement` (`start` | `center`), plus `hasTableOfContents()`.** With children Core reserves the outline's space beside the document so it never covers text: a persistent outline column from `lg` (mono title label, one 1px line, nested `sm` rows, current row in ink with a moving 2px marker, independent scroll, current row kept in view), the quiet hover/focus rail from `sm`, and the same rail on phones (previously omitted). PostViewContent (`center`) and PageContentView (`start`) adopt it. Without children the standalone fixed rail is unchanged (legal, changelog, works, events).
- **Rail scrubbing:** press (touch/pen, or a mouse drag) opens the outline and highlights the heading under the pointer, release navigates with the existing focus/reduced-motion handling, `pointercancel`/Escape/a far sideways move cancels. `touch-action: none` on the rail; coarse-pointer target 44px; nothing extra is announced.
- **Nested outlines:** the outline is a nested list built from authored levels (skipped levels nest one step); one `md` indent per level capped at three visual levels; long titles wrap with a hanging indent and clamp at three lines; parents of the current row are shown in ink; rail marks encode depth by length. The floating list's current row is ink with strong weight like the column (was the blue accent), so one current-state language spans rail, list and column.
- Migration: none required for existing props. Consumers that want the column or the phone rail pass their document as `children`. Stories: `Core/Navigation/TableOfContents` ReadingColumn, MediumRail, PhoneRail, DeepNesting, ScrubNavigation; `Pages/Public/Documents` post/page long documents. Contract: [table of contents](table-of-contents.md).

## 2026-10-13 · Region input size

- New Core `InputSizeProvider` declares one input size for a region; an explicit `size` still wins and a compact toolbar still forces `xs`. All 13 remaining Core inputs (FileInput, PinInput, Textarea, Checkbox, ColorInput, date inputs, DateTimeInput, SegmentedControl, Switch, NumberInput, Slider, TagsInput, Radio) now resolve size through the same path as TextInput and Select.
- Page block settings declare `xs` once (`PageBlockSettingsSurface`, immersive scene inspector, section settings popover). About 130 per-field `size="xs"`/`size="sm"` props are gone from block settings editors. The list block filter's Title label was 14px beside 12px labels, and list/gallery Switches were `sm`; every label, choice label and segment in the panel is now 12px.
- Block settings field stacks use `md` (12px) between fields, matching the field column rhythm.
- The account shell renders its route content as the selected `Tabs.Panel`; the tabs no longer point `aria-controls` at a panel that did not exist (axe `aria-valid-attr-value`).
- Contract: [input contract](input-contract.md#region-size).

## 2026-10-13 · Document print and post header

- **Print uses the light semantic roles in every theme.** The token generator emits `@media print { :root, [data-geul-theme] { …light roles !important } }`, so dark and custom presets no longer print light text or dark chrome on paper; `variables.css` prints the body on `paper-background` (the theme-surface rule previously out-ranked `print.css`). The global heading ink rule skips Core `data-tone="inverse"` headings, so post/work hero titles stay legible on their printed image.
- `ApplicationFrame` print resets `main` for every frame kind. The site frame's fixed-header offset (76px) no longer leaves an empty band above the print header; the workspace navigation margin no longer narrows paper.
- Print spacing is on the shared scale: print header `md` padding / `xl` margin with a `border-thin` paper-ink hairline (was 0.4cm/0.6cm), post content flow `md` (was 12pt), stacked page sections and columns `xl` (was 6mm). The print header keeps its identity block at the inline end without a logo.
- **`ContentLayoutView` owns the document chrome → body gap** (`md`, flow and pinned, screen and paper). Page titles no longer touch the first section; `PostViewContent` drops its own block-start inset (posts unchanged at 12px).
- **Post title uses `DOCUMENT_TITLE_SCALE`** (new export of `@/features/document-layout`: heading scale 2 below `sm`, 1 at `sm`+), the Page title size, one step above authored `h2` (was scale 2 = body `h2`, hero 3/2). Title → metadata is 16px in plain and hero headers.
- **`PostHeader`: `languageControl?: ReactNode` replaces `reserveLanguageMenuSpace`.** Edit, Markdown and the content language menu share one 8px action row centered on one axis (hero: `md` inset; plain: the title's first line). The language menu no longer floats at the corner with a fixed 4.5rem reservation that overlapped the Markdown button by 3px. The hero now shows collaborators like the plain header, and both render one metadata definition.
- Core `PublicMetadataValueGroup` gains `separator?: 'none' | 'slash'` (default `none`; the glyph is `aria-hidden`). Post collaborators, categories and tags use `slash`, matching the author list. A `PublicMetadataRow valueAlign="center"` now centers its label too (authors label sat 4px above its name).
- Post series previous/next links are print-hidden (name and part remain), use 16px glyphs (were 14px) and mirror in RTL. They are muted `TextButton` links with an 8px glyph gap, so the chevron sits on the series row's icon line and the title on its name line (low-emphasis Button padding had pushed them inward).
- The mono font stack falls back to system monospace (`ui-monospace`, SF Mono, Menlo, Consolas, Liberation Mono) before generic `monospace`; without a local Noto Sans Mono, metadata labels rendered in Courier. The authored body carries `dir` from its content locale.
- Hero print drops the extra `brightness/saturate` filter and 8mm margin: paper uses the screen shade and the layout gap.
- Storybook canvas print: the review context header is hidden and the canvas no longer paints the theme surface or a full-viewport page, so print previews match production paper.
- Tooling: `story-screenshot-compare.mjs` accepts `media`, `pdf` and `--label`; new `scripts/design-system/pdf-contact-sheet.swift` renders PDF pages for review. Contract: [post hero](post-hero-contract.md#print).

## 2026-10-13 · Spacing relationship audit

- **`spacing-role-field-label` is now 4px (`spacing-xxs`, was 8px).** Core Input's root consumes the role instead of a literal `xxs`, and Core Field's label row uses `font-size-sm`/`line-height-sm`, so Field and every Input share one label → control → help rhythm. Field consumers (Bio, Website, phone and social-link fields, Display name) move about 6px closer to their controls; Input geometry is unchanged.
- ConfirmModal's string message renders through Core `Text` (no UA paragraph margin): body → actions is 12px like FormModal and BlockingAlertDialog, and the message no longer adds 16px under the header.
- Consumers: SectionHeader → content uses `md` in account settings (email, sessions, passkeys, connected accounts, MCP, danger zone), admin user sign-in sections and the Page/Post editor Options block; artist, label and release public headers use the same 16px title → metadata as works and events; site asset uploads follow Field's label/description block.
- Enforcement: the token scanner and ESLint `design-tokens` rule check `inset`/`inset-*` literals and literal spacing in JSX `style` objects. New exception map `authoredGeometryFiles` (immersive scene presentation only). The token baseline stays empty.
- New tool: `node scripts/design-system/spacing-audit.mjs static|measure` lists Layout/CSS spacing by relationship and measures rendered sibling and label/control/help gaps in Storybook. Relationship table: [spacing contract](spacing-icon-contract.md#composition-relationships).

## 2026-10-12 · On-demand overlays for application chrome

- **Hosts load on demand.** `ConfirmDialogHost` and the new `NotificationHost` (replaces mounting `NotificationRegion` directly) render nothing until the first `confirmDialogs.open()` / `notifications.show()`, then load their renderer and stay mounted. Requests made before that wait in the existing module queues and are shown when the renderer arrives; nothing is dropped. The trigger keeps focus meanwhile, so focus returns to it on close. Both take `loading?: 'on-demand' | 'eager'` (default `on-demand`; `eager` loads on mount for Storybook and tests). `preloadConfirmDialogs()` and `preloadNotificationRegion()` start loading early. `notifications.ts` now imports `ToastQueue` from `react-stately/useToastState` (new direct dependency `react-stately@3.51.0`, the version React Aria Components already uses).
- **New on-demand variants with the same props, members and markup:** `OnDemandDropdownMenu` (`@/components/core/DropdownMenu/OnDemandDropdownMenu`), `OnDemandTooltip` (`@/components/core/Tooltip/OnDemandTooltip`) and `OnDemandDrawer` (`@/components/core/Drawer/OnDemandDrawer`), plus `preloadDropdownMenu()`, `preloadTooltip()`, `preloadDrawer()`. The trigger is built from React Aria's trigger hooks (`useMenuTrigger`/`useMenuTriggerState`, `useTooltipTrigger`/`useTooltipTriggerState`), so it renders and hydrates without the Menu, Popover, Tooltip or Modal modules; the surface loads on the first pointer enter, focus or press and is shown as soon as it arrives. After the first load every instance renders synchronously. Use them for always-present chrome (site header, footer, content-language menu); screens that already ship overlay code keep the eager components. SSR markup is identical to the eager components (tests compare it).
- `ApplicationFrame` (site kind) uses `OnDemandDrawer` for its navigation drawer and preloads it when the pointer or focus reaches the `MenuToggle`.
- `preloadOnDemandOverlays()` (`@/components/core/on-demand-overlays`) loads every on-demand surface. Storybook's preview `loaders` call it, so previews, play functions and visual checks render overlays synchronously; tests that assert on these overlays call it in `beforeAll`.
- Internal: `DropdownMenu` and `Tooltip` share their open-state/hint logic with the on-demand variants (`dropdown-menu-root.tsx`, `tooltip-root.tsx`); `DropdownMenu.Dropdown` recognises section labels by a marker instead of identity. Behaviour and markup of the eager components are unchanged.
- Review fixes (2026-10-13): an `OnDemandDropdownMenu` open request made before the surface loads is cancelled by Escape on the trigger, focus moving elsewhere or a press outside the trigger, so the menu no longer opens and takes focus afterwards; Escape before an `OnDemandDrawer` loads dismisses a dismissible drawer (`onClose`). `NotificationHost`/`ConfirmDialogHost` retry a failed renderer chunk again on every new request and when the browser comes back online, not only three times after the first request (`useOnDemandModule` gains an optional `request` signal).
- No visual change: Storybook frames and public document stories compared pixel-for-pixel before/after on desktop and 390 px, light and dark, including open tooltips, menus and drawers. Measurements: [bundle architecture review](../performance/bundle-architecture-review.md#implemented-on-demand-overlays-server-rendered-shell-scoped-react-query-items-4-5-6).

## 2026-10-12 · Client bundle boundaries

- `package.json` declares `sideEffects` (CSS, form-field registrations, Monaco setup/workers, runtime-config locale setup, client instrumentation). Core family barrels are now tree-shaken: importing one export no longer ships every module in the family (for example `@/components/core/Input` no longer adds date, color, slider and combobox code to `/login`). A module imported only for its side effects must be listed there; `scripts/performance/side-effects-declaration.test.ts` enforces this for bare local imports. Modules with top-level effects that are also re-exported through a barrel must be listed too.
- New `SocialIdentityIcon` (`@/components/core/Social/SocialIdentityIcon`) draws the Google and GitHub sign-in marks with the same output as `SocialIcon` without loading the social-link platform catalog. Login and account-email surfaces use it. `SocialIcon` is unchanged. Brand palettes moved to `components/core/Social/brand-colors.ts`, and the token-policy palette exception moved with them.
- No visual or prop changes. Measurements and the per-route budget guard (`pnpm perf:bundle`) are in [bundle budget](../performance/bundle-budget.md).

## 2026-10-13 · Compact choice controls and input glyphs

- Checkbox, Radio and Switch share one compact grid: a 16px indicator (`chrome-icon-size`), an 8px label gap (`spacing-xs`) and a 28px row (`control-height-compact`; 44px for coarse pointers). Checkbox no longer scales with the font (`1em + 2px`) and no longer uses a 4px gap and 16px row that differed from Radio.
- Switch shrinks from a 42×24px track (36×20px compact) to 28×16px with a 12px thumb in every density, so it carries the same weight as a checkbox beside 14px text. Colors, states, RTL travel and reduced motion are unchanged.
- Select, MultiSelect, NativeSelect, TagsInput, FileInput and date-input accessories draw Core glyphs (`InputOpenGlyph`, `InputClearGlyph`) at `chrome-icon-size` instead of the text characters `⌄` and `×`; the open chevron turns while the popover is open. Tag removal uses the pill's 12px text size.
- One state language for choices: off is an empty 1px `border-strong` outline (Switch drops its grey fill and keeps a `text-secondary` thumb); on is one `text-primary` mass with a `text-on-action` mark — a filled Checkbox with a light check or minus, a filled Radio with a 6px light point, a filled Switch track with a light thumb. Disabled keeps the same shapes in `text-muted`.
- Every input accessory (open, clear, calendar, password visibility, validation) is a 16px Core glyph with a 1.5 stroke matching the 1px field line; the `▦`, `◌`, `✓` and `!` characters are gone. Asynchronous validation and search loading use the shared Core spinner.
- MultiSelect and TagsInput pills are 20px high with 12px text, one 1px `border-strong` line and no fill.
- No public API changes. Review: `Core/Input/Switch`, `Checkbox`, `Radio`, `MultiSelect`, `Input States` stories and `Pages/Forms/Public Response/All Fields`.

## 2026-10-12 · Control follow-ups

- Select gains `clearLabel` so a clear command can be named for its effect; SeriesSelector uses "Remove post from series" again. The default remains the shared "Clear all" label.
- One Core spinner owner (`components/core/Spinner.module.css`) is shared by Display Spinner and Button/IconButton pending states. Rotation uses the new `motion-spin` token (1000ms); button pending glyphs no longer spin at 300ms. Reduced motion stops the rotation.
- Button, IconButton, TextButton and NavigationLink forward accepted `title` and `tabIndex` through one link render hook (`control-render.tsx`); React Aria previously dropped them on links and TextButton actions. Unavailable links still render a non-navigating span.
- SegmentedControl icon options show their hint from the radio's own hover/focus state through `AnchoredTooltip`, removing React Aria's nested-trigger development warning. Keyboard focus shows the hint immediately; hover keeps the 500ms delay.
- Removed one-off migration and audit scripts (`audit-*`, `summarize-audit`, `inventory-actions`, `migrate-*`) whose evidence predates the current source.

## 2026-10-12 · Core ownership consolidation and token cleanup

**Tokens.** Removed 11 unused invariant tokens (`text-image-chrome`, `shadow-image-chrome`, `paper-border-soft`, `overlay-muted`, `overlay-video-status`, `overlay-border-muted`, `overlay-caption`, `overlay-spinner-border`, `shadow-media`, `shadow-map-panel`, `shadow-image-text`). Merged `action-hover` → `surface-hover`, `action-pressed` → `surface-active` and `chrome-action-size` → `control-height-chrome`. `--geul-breakpoints-*` are no longer emitted; use `primitiveTokens.breakpoints`, `breakpointQuery` or `$mantine-breakpoint-*`. Ocean Dark drops three no-op overrides (Ocean Light 14, Ocean Dark 9). Light warning actions use yellow 700/800/900 so pressed differs from hover. New layer roles `sticky`, `banner`, `floating`, `toast` and `progress` replace numeric z-index literals; toasts move from `tooltip` to `toast`. See the [token migration table](./token-contract.md).

**New Core owners.** `EmptyState`, `CopyButton`, `SearchInput` (and `SearchComboboxView leadingGlyph="search"`), `StatusIcon`, `BlockSelectionTarget`, `InputFrame`, `MediaWaveformSeek` (+ `applyAudioSeekPresentation`, `resolveMediaSeekKey`), `useSortableItem` and `prepareSocialIcon`. Avatar gains `name` (Core-derived grapheme initial; blank names show the person glyph). Pagination gains a link mode (`getHref`). IconButton and ToolbarCommand gain `pressed`. SegmentedControl gains icon-only options. NavigationLink gains `appearance="graphic"`. UploadPlaceholder gains `onPress`. FilePicker gains `id`. SocialIcon supports `google`. PublicMetadataLink gains `indicator="external"`. TableOfContents hides itself in print.

**Consumers migrated.** About 52 Feature/App files moved to the new owners (empty states, copy buttons, search fields, avatars, stat cards, status glyphs). 13 reorder rows use `useSortableItem`; Features no longer import Dnd Kit `useSortable`/`CSS`. Editor contextual menus use ToolbarSurface, Separator and one `EditorToolbarAction` adapter; editor block selection uses BlockSelectionTarget. The audio player seeks through one native range, and Core no longer styles Feature-emitted `audio-player__*` classes. File inputs use FilePicker; logo/image links use NavigationLink. Alert, Notification and LabelBadge close/dismiss use Core IconButton with the coarse-pointer minimum. Eleven unreferenced Feature stylesheets and the unused FormField style object were removed.

**Breaking API and migration.**

- StatCard `icon` takes a glyph component: `icon={<Icon size={20} />}` → `icon={Icon}`.
- TableRowMenuItem `color` → `tone: ControlTone` (`'red'` → `'danger'`, `'orange'` → `'warning'`).
- IconButton `controlSize` removed; use `size`. Toggles use `pressed` instead of `aria-pressed` plus tone/emphasis.
- MenuToggle `size` and `MenuToggleSize` removed. ContentCard, ContentCardSection and ContentCardProps removed; use SectionCard.
- Removed `badgeToneFromColor`, `statusToneFromColor`, `getBadgeToneColor`, `notificationToneFromLegacyColor`, `getControlToneColor`, `resolveControlStyle`, Checkbox `onLabel`/`offLabel`, Switch `indeterminate`, `TextButtonCssVariables` and `TextButtonStyle`.
- SocialIconGlyph takes `icon: PreparedSocialIcon` from `prepareSocialIcon`; arbitrary `path`/`light`/`dark` props are removed.
- `ControlNativeProps` and `OverlayPresentationProps` reject every `ClosedVisualProps` key; presentation roots drop caller-supplied Core-owned state attributes.

**Behavior fixes.** Button and IconButton actions forward their accepted native `title` (React Aria filtered it), so a disabled command can still expose its advisory phase. Select no longer reopens its listbox when a caller updates a controlled `searchValue` while the field is focused (for example after selection or a restored server value); user typing still opens it. SeriesSelector restores the unavailable-Series placeholder and the `#n` ordinal.

**Visible changes to review.** Empty-state glyphs use muted ink at 48px. Dismissible badges are taller (28px target). Pagination numbers use Core Button geometry and `…`. Marquee text links underline on hover instead of changing color. Route progress fades in 100ms. Share-link copy uses its full tooltip label. Source, type, unit and generated-catalog checks pass; browser review of the migrated production screens in dark theme, mobile/coarse pointer and RTL remains open.

## 2026-10-12 · Long-document navigation

- TableOfContents replaces the rejected list-button/search-panel draft with a quiet rail that reveals one bounded scrolling title list on hover or keyboard focus. The list retains every heading; only decorative mark density is bounded. This correction follows mouse inspection of the actual Notion desktop outline.
- Pointer selection moves to the heading while the outline stays open until the pointer leaves. Reopening begins at the first title. List scroll remains independent of document scroll. Keyboard entry, Escape, native link activation, target focus and reduced motion remain available. Public props and actual document IDs are unchanged.
- The existing below-md omission is retained without adding a mobile floating button. Production post/page long-document fixtures exercise the same Core owner. No theme tokens or article layout are replaced.
- The Core owner uses cached document targets and binary scroll lookup in vertical geometry order, refreshed when content resizes. Missing target IDs no longer shift active item indices. PageContentView now connects authored rich-text headings, including nested columns, to the same navigation owner; the previous production connection was missing. Post, legal and changelog retain their existing adapters.
- The earlier shared Popover containment fix remains independent of this outline, which is nonmodal and does not lock body scroll. Story title copy uses the actual tableOfContents message rather than a generic Contents translation.

## 2026-10-12 · Editor settings, language names and dialog actions

- PageEditor and PostEditor share compact content-width layout choices that wrap according to available space instead of reserving three full-width rows. Their values and radio semantics remain unchanged. SegmentedControl now distributes fullWidth options and respects compact block padding.
- Core Switch uses a rounded track and circular thumb, with explicit compact geometry using existing tokens. Optional on/off text moves outside the track to avoid colliding with the thumb; its decorative status and native checked semantics remain. No prop migration is required. Atlassian and Geist live examples informed the geometry; Geul retains its own semantic palette and focus contract.
- Editor and public content language triggers use native language names rather than locale codes; source context, selection and locale callbacks remain unchanged.
- Core DialogActions owns end-aligned, wrapping, content-width concluding commands. Standard modal wrappers and composed editor, admin, account, release and legal dialogs adopt it. Browse files is the final command; map providers and isolated download/close commands align to the end. Separate destructive commands use leadingActions. Migrate concluding LayoutInline rows to DialogActions; ordinary toolbars keep their own layout.

## 2026-10-12 · Compact product review corrections

- Progress, ProcessingOverlay and RouteProgressBar consume one Core bar; optional title/status use compact typography. Processing retains a protective overlay and image contrast, while route chrome has no surrounding inset. Map loading consumes the existing site PageLoader without another status card, including configured loader media.
- Core Modal/Drawer default to compact chrome with a fixed header and scrolling body. Standard density remains explicit. Map directions uses compact provider commands. The editor More menu is document-portaled and its owned focus preserves the editor selection/bubble lifecycle.
- Password visibility uses actual Eye/EyeOff glyphs. MCP endpoint terms are visually hidden while accessible names remain; session bulk logout aligns to the logical end. Verification back commands omit the redundant arrow.
- Share-link creation uses a named plus IconButton and compact form composition. Narrow social rows use a platform icon picker with searchable choices and leave the address track available.
- Translation rows show language names without duplicate codes or repeated passive badges. Logo fallback uses the site title or LOGO with named Typography sizes. Avatar removal has the user-requested compact danger/strong treatment; other upload removals retain their defaults. Legal history states use plain text.
- File search summaries use compact actions; file and version-history pagination consume the shared NearEndLoader with pending, end, retry and stale-request boundaries. Version history now reads beyond its first 20 records and aligns restoration to the end.
- Managed raster sources prepare locally before crop/upload, without an original-byte cap; prepared target limits and unsupported/failed decoding recovery remain. Redundant persistent image ratio/size/format help is removed.
- Sortable shells retain motion/sensors while memoized domain content avoids transform-only re-renders. PostHero uses normal-flow metadata, contained image geometry and shared body spacing.
- Cookie consent exposes clear Reject/Accept all decisions as equally presented compact TextButtons. The single optional Google Analytics category is disclosed; the account settings draft/save flow, consent version and persistence remain.

These changes are prepared for local review. Source, browser, service and assistive-technology acceptance
remain distinct; final execution evidence identifies the tested snapshot and any remaining integration boundaries.

## 2026-10-12 · Review interaction and geometry corrections

- Core Chart positions hover labels immediately at the pointer. Only Recharts tooltip-position animation is disabled; chart data, series animations and keyboard/table alternatives remain.
- Editor selection menus share compact Core ToolbarSurface chrome. Table command groups form one centered row, and map/video width readouts align with command glyphs. Executable floating menus retain block alignment/deletion while runtime and source controls stay on the executable surface. Native title and Monaco editing suppress unrelated selection bubbles temporarily.
- Cookie consent always displays the Analytics setting with two equal-sized decisions: reject non-essential or save the selected choice. The redundant one-category disclosure and accept-all action are removed from the banner and account settings. Cookie schema/version, renewal, persistence and account synchronization remain unchanged. See [cookie consent](./cookie-consent-contract.md).
- FileManagerView applies one shared Core content inset to its toolbar and grid/list viewport. Selection, marquee coordinates and view-switch state retain their existing owners. See [file browser](./file-browser.md).
- Reorder grips retain stable leading targets with glyph-only hover/pickup emphasis. DateRange uses intrinsic sequences; date focus underlines text instead of painting a square. The compound date segment keeps a 28px minimum width and 44px coarse height, without overlapping targets. See [size and density](./size-density-contract.md).

These are source changes for review. Browser execution, assistive technology, single-pointer
reorder alternatives and deployment are recorded separately; no complete accessibility approval
is inferred from the visual corrections.

## 2026-10-12 · Executable title editing

- Restored Tiptap's native control event boundary in the p5, Three.js and Shader node views. Title input, selection and clipboard events stay inside their Core input instead of replacing the selected executable block.
- Retained nested Monaco isolation and Shader input-reference isolation, with Tiptap still owning ordinary surface and drag/drop behavior.
- Shader title updates preserve the selected executable node or owning block container while replacing attributes. Its multi-stage source and preview settings remain intact.
- The published Shader adapter accepts omitted channels as the existing four unconfigured inputs, matching a newly inserted editor Shader. Explicit malformed channels and incomplete stage trees remain invalid.
- Empty authoring titles use the existing localized fallback as a placeholder. The stored title remains empty until the author types; published output continues to use the fallback for an empty title.
- The existing Executables stories exercise clearing, typing, publishing and returning to edit mode. Read-only and localized authoring permissions retain their existing contracts.

Owners: `features/editor/tiptap/code-editor/source-editor-boundary.ts`, the three executable node views,
and `features/executable/ExecutableRuntimeControls.tsx`. The shared Core TextInput API and tokens are unchanged.
Review `Feature / Editor / Executables / P 5`, `Three` and `Shader` for the actual editor-to-publication flow.

## 2026-10-12 · Token and command-spacing consolidation

- Removed seven unused media/docked semantic roles from both base themes and generated CSS after checking production consumers, theme overrides, aliases, adapter lookups and tests.
- Kept the active waveform, embed, authored document, palette and image roles. Equal-valued roles retain their separate meaning and derive from the same existing foundation.
- Changed DataTableActions to the existing `action-group` relationship: 4px → 8px at a 16px root, retaining wrap behavior.
- Connected media command clusters to `toolbar-item`, outer media groups and video settings commands to `action-group`, with their existing 4px/8px values preserved.
- Added the actual table-toolbar action-group recipe and a browser play check for resolved gap and glyph frame.

See the [token migration record](token-contract.md#2026-10-12-consolidation-and-migration)
for removed public keys and current owners. No in-repository consumer uses the removed
roles. External copied CSS or runtime token lookups must migrate before consuming this
source change. Browser review and deployment are recorded separately.

## 2026-10-12 · Mermaid names and authored descriptions

- A rendered Mermaid diagram uses a permitted `div[role="img"]` host and exposes one image name through its visible caption; the inner SVG pixels no longer repeat that name as alt text.
- The renderer carries authored `accTitle` and `accDescr` metadata across the SVG image boundary. Distinct title and description information remains available as the diagram's accessible description.
- Loading/error states use `div[role="figure"]` and keep their status/alert semantics. Source, visible caption, rendered SVG and persisted block fields are preserved.
- Added mounted name/description regressions, renderer metadata tests and the actual Accessible Description story. Editor/public comparison checks wait for the generated image to load.

Read the [Mermaid representation contract](./mermaid-contract.md#accessible-diagram-representation).
Browser checks and screen reader review are recorded separately.

## 2026-10-12 · Source notation contrast

- Replaced inherited VS notation colors that missed 4.5:1 on the light editor surface with existing document green, blue, red and primary text roles. Inherited language-specific child rules and paired-bracket colors use the same palette.
- The shared Monaco adapter follows all four named presets without adding a syntax token scale or changing authored code.
- Added regressions using the installed Monaco matcher for first-class JavaScript, TypeScript and GLSL categories and every inherited VS foreground category, checked against editor, line-highlight, selection and search surfaces.
- Added `Feature / Editor / Source Editor / Syntax Contrast`, which waits for actual JavaScript tokenization and measures rendered text against the selected preset. Review all four header themes in the browser.

The source regression suite reports 23 passing tests across the adapter, contrast and runtime
files. Browser execution and assistive technology acceptance are separate review records.

## 2026-10-12 · Storybook documentation and review environment

These changes are reflected in the repository working tree.

- Connected Foundations to token intent, typography, spacing, icons, size/density, responsive, specimen layout and accessibility rules.
- Connected Core documentation to current source APIs, states, consumers and actual running examples.
- Connected Pages documentation to production Views, routes, fixture states, service boundaries and viewport review requirements.
- Made getting started, contribution, change records and paired Core usage examples discoverable in Storybook.
- Corrected documentation links, heading navigation, theme/locale preservation and mobile code wrapping.
- Retired the repository's external design-file generation and synchronization workflow; Storybook is the shared documentation and review environment.

This documentation change does not replace existing public Core APIs.
When updating documents and indexes, refresh generation, checks and review records using the [contribution process](./contribution.md).
Use the verification record for actual execution evidence and unresolved items. Documentation registration is not complete design or accessibility approval.

## 2026-10-12 · Named theme presets and compact composition

- Added `light`, `dark`, `ocean-light` and `ocean-dark` definitions in `lib/theme/themes.ts` and `ThemeId` projection through `themeVariables`.
- Ocean Light and Ocean Dark override 16 and 13 existing semantic roles respectively, reusing existing primitive palettes without new role names or colors.
- The shared provider supports preview `forceTheme`, exposes the selected ID/base scheme, and projects overrides to document-root and portaled UI.
- Preview switching, unmounting and nesting restore owned overrides and original inline priorities; preview selection does not read or write saved app preferences.
- Compact layouts retain existing size, spacing and density roles; custom palettes do not change command tone/emphasis or the coarse-pointer minimum.

The theme owner reports 105 matching contrast/provider regression tests and scoped lint passing.
Actual browser observations for all four presets, localized pages, document variables, portaled
controls and source notation are recorded in the [review evidence](./storybook-review.md).
These results do not establish design approval, assistive technology acceptance or deployment.
Application preferences remain light/dark/auto. Named custom presets currently belong to preview selection.

## 2026-10-12 · Public page motion controls and complete information

- Marquee now provides persistent pause/resume and a single wrapping copy of resolved items while paused or motion is reduced.
- Immersive scenes stop owned playback, frames, rotation and pointer effects while paused, preserve playback progress on resume, and expose all authored titles, descriptions and attribution through Core Disclosure.
- Reduced-motion scenes open the complete information path by default and avoid a frozen multi-unit scroll sequence.
- Serialized block shape and public props remain unchanged; visible motion controls use three new messages in all 20 locale bundles.
- Missing light scene backgrounds now default to the existing paper surface, matching theme-derived copy. Explicitly stored colors are preserved; no authored data is rewritten. Actual-default fixtures and four-preset text contrast checks cover the fallback.
- Added actual public-renderer Storybook fixtures and selected renderer/message regression checks: 182 tests passed.

Read the [public page motion contract](./page-motion-contract.md) for ownership, usage and limits.
Fresh browser, axe, WebGL and assistive technology review remain separate. The change does not establish visual equivalence for meaningful 3D assets or verify external data and destinations.

## 2026-10-12 · Pending announcements and custom diagram themes

- Persisted the React Aria 3.53.1 live-announcer correction through pnpm's patch and
  dependency-extension configuration. It captures the computed accessible name before
  delayed delivery and source unmount while retaining urgency, timing and cleanup.
- Added Button/IconButton regressions for pending focus, activation prevention and
  announcement lifetime, plus a Notification title/description lifecycle regression.
- Updated mounted Mermaid diagrams when the selected custom preset changes within the
  same light/dark base. The previous render is aborted and the replacement resolves
  current semantic colors without changing authored diagram content.
- Updated token, editor color, Mermaid and toolbar contracts for the shared four-preset
  registry without introducing new token roles.

See the [announcement lifecycle contract](./announcement-lifecycle.md) for the patch
boundary, upgrade rule and test commands. These source regressions do not establish
assistive technology acceptance or design approval.
