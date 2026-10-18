# Table of contents: reading rail and scrolling outline

This is the contract for the Notion-based scrolling correction.
Executed automated and browser checks are recorded separately in the review evidence.

## Scope and ownership

This guide covers the page-side table of contents, especially long-list scrolling.
It does not replace the rest of the design system, page layout or authored document.
Core `TableOfContentsView` owns presentation, opening, focus, scrolling, scrubbing and the
inline space reserved for the outline beside a document, and publishes that space to document
chrome outside it (`tableOfContentsScope`).
The navigation Feature supplies translated UI copy.
Post, page, legal, changelog, work and event Views supply their actual heading IDs, text and levels
and pass their document as `children`. Since 2026-10-13 there is no standalone fixed rail: every
outline reserves its space beside the document it navigates.

## Reference evidence

| Reference                                          | Visually inspected                                                                                                                                                                           | Applicable behavior                                                                                                                   | Limits                                                                                                                                  |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Notion desktop app, 2026-10-12                     | A real 26-heading document: compact rail, expanded outline, scrollbar track clicked to later entries, entry selected and highlighted in the document, outside area entered, outline reopened | Quiet right-side marks; an adjacent floating title list; indentation; current-section emphasis; a bounded list with its own scrollbar | Pure hover without clicking, wheel boundary behavior, physical touch, mobile Notion and native screen-reader behavior were not verified |
| User-supplied ChatGPT screenshot, 2026-10-12 14:56 | The actual image: thin marks, a longer current mark, a floating card containing a title and body excerpt                                                                                     | Low visual weight while reading; contextual information appears next to the rail                                                      | The image alone does not establish keyboard, scrolling or mobile behavior                                                               |

[Notion's official contents guide](https://www.notion.com/help/columns-headings-and-dividers#table-of-contents)
documents a page-side outline revealed on hover, heading hierarchy and navigation.
It supplements the directly inspected app. It does not substitute for visual inspection.
No other product is a reference for this change.

For Geul, use Notion's scrolling heading list as the navigation model.
The ChatGPT image informs the quiet rail and adjacent reveal, not a new search interface
or a claim that its conversation excerpts are document headings.
A body-excerpt card is outside this scrolling correction; do not fabricate summaries
or add another competing navigation surface.

### Direct mouse investigation

Each mouse action was followed by an actual screenshot. These findings concern the
observed desktop document only; they are not inferred from markup or source code.

| Step | Actual operation                                             | Visible result                                                                                                                       | Local evidence            |
| ---- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| R1   | Click the compact rail with the mouse                        | A floating title list appears at the right; the article keeps its width                                                              | `01-open.png`             |
| R2   | Click the lower track of the outline scrollbar               | Later titles replace earlier titles inside the same surface; the article remains at its previous section                             | `02-inner-scroll.png`     |
| R3   | Click a later title in that list                             | The document moves to that heading; it is briefly highlighted; the selected outline entry is blue                                    | `03-selected-heading.png` |
| R4   | Move to and click the blank top toolbar, outside the outline | The title list closes and small marks return                                                                                         | `04-closed.png`           |
| R5   | Re-enter the rail by mouse click                             | The outline starts at its first entries even though the document is near its end; it does not automatically center the current entry | `05-reopened.png`         |

The list stayed open after R3 while the pointer remained inside it. Selecting a title
did not itself dismiss the surface. These findings replace the former draft's
immediate-close behavior and current-row centering.

Long titles in this Notion screen used multiple lines, with an ellipsis on an overlong
entry. Indentation expressed heading levels. No search field, separate list-icon
launcher, section-collapse chevrons or persistent count appeared in the inspected outline.

Evidence is local and ignored by Git, under
`.artifacts/design-system/references/notion-toc/`. It contains the user's workspace
screen and is not copied into the published Storybook bundle.
One attempted drag navigated the article instead of isolating list scroll; it is not
used as proof of independent scrolling. The scrollbar-track result is the positive
evidence. No claim is made about untested hover timing or overscroll behavior.

## Presentations (2026-10-13 owner decision)

The owner approved three presentations of the same outline for reserved layouts. They stay
in the Notion/ChatGPT interaction family: a quiet indicator, a revealed title list and, when
the screen has room, the same list kept visible. No floating launcher or search panel is added.

| Viewport (reserved layout) | Presentation                                                                                                          | Reserved inline space                                               |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `lg` (75em) and wider      | Persistent column: mono `xs` title label, one 1px line, `xs` secondary rows, current row in ink with a 2px ink marker | Column (15rem) + `xl` gap at the inline end                         |
| `sm`–`lg`                  | Quiet rail; hover, keyboard focus or a press reveals the bounded title list                                           | Rail target width (28px; 44px on coarse pointers) at the inline end |
| below `sm` (phones)        | The same rail, scrubbable by touch                                                                                    | Rail target width at the inline end only                            |

The column starts at `lg`. Every document starts at the frame's start edge and runs up to the reserve at
the inline end (owner decision 2026-10-18, replacing the balanced 2026-10-13 reserve that centered the
reading column): the title, hero text and running text share the start edge, and the outline column
sits at the inline end. The column and rail are sticky inside the reserved track, below the site header,
and stop at the end of the document box, so the footer boundary needs no measurement. The document
plays (`stories/public/fixtures/document-outline.ts`) assert that no reading block or reading chrome
reaches the outline (`assertOutlineClearance`) and that the first reading block starts where the title
starts.

The outline is never taller than the viewport below the sticky line. Until the document has
scrolled the outline up to that line (it starts below a title or hero), Core also subtracts the
remaining distance, so the column and the revealed list fit the first screen with their own scroll
instead of running off its bottom (written per frame as a style property, no re-render). At the
document end the outline leaves with the document box like any sticky element.

### Placement

There is one placement: the document starts at the start edge and only the inline end is reserved.
Running text (posts, legal documents, the changelog) keeps the reading measure from that edge; CMS
pages and entity details keep their section composition. The `center` placement was removed on
2026-10-18.

`outlinePresentation="rail"` keeps the rail at every width for a body that shares the page width with
another column: an entity detail with media. The persistent column needs a full-width body.

### Chrome outside the outline layout

Titles, heroes and overlaid document controls are rendered by `ContentLayoutView` outside the outline
layout. Its root carries `tableOfContentsScope`; inside it `--_table-of-contents-inset-end` holds the
reserved inline space (0 without an outline and on paper). `ContentChrome measure="reading"` keeps the
reading measure on the start edge clear of that space, the post hero ends its title where the reading
measure ends, and `ContentLayoutView` ends its document
controls at `--_table-of-contents-inset-end`. A content-language menu therefore never sits over the
outline column (it overlapped the column label on untitled pages before), and every title shares the
first body line's start edge at every width.

Persistent column details: the label is the `tableOfContents.title` copy and names the
landmark (`aria-labelledby`). Rows are real links in a nested list, compact for a fine pointer and
at the shared 44px `interaction-minimum` on coarse pointers (tablets in landscape reach `lg`). The
marker moves to the current row with `motion-normal` (instant with reduced motion). When the current
row leaves the column's own scroll area it is scrolled into view inside the column only, never while
the pointer or focus is in the column. The column scrolls independently and contains overscroll.

Reading and focus order: the outline precedes the document in the DOM (its track is out of flow,
so this does not change the layout). Tab reaches the outline right after the document chrome — one
rail stop below `lg`, the column's links from `lg` — then continues into the document, as the column
is seen beside the document's first lines. Links follow authored document order and nesting.

### Rail scrubbing

Pressing the rail (touch, pen, or a mouse drag of more than a few pixels) opens the outline
and highlights the heading at the same proportional position as the pointer; the outline
scrolls (itself only) so that row sits level with the pointer, beside the finger rather than at
the list's lower edge under the hand, and the rail's current mark follows the pointer. Releasing
navigates exactly like link activation (focus moves to the heading, reduced motion respected)
and, for touch, closes the outline. `pointercancel`, Escape or moving sideways more than
three rail widths away cancels without navigating. The rail uses `touch-action: none` (the
page does not scroll while scrubbing), suppresses the link callout and selection, and the
click that follows a scrub is ignored. A plain mouse click keeps the hover outline behavior.
Scrubbing only previews: `aria-current` and announcements do not change until navigation.
Keyboard and screen-reader users keep the link list.

### Nested headings

The outline is a nested `ol` built from authored levels in document order (`tocOutline`).
A skipped level (h2 → h4) nests one step; a shallower heading closes deeper sections.
Rows indent one `md` step per outline level, capped at three visual levels so deep headings
neither drift nor squeeze their titles. Long titles wrap with a hanging indent and clamp at
three lines; the complete title remains the link's accessible name. The current row's
containing sections are shown in ink (`data-ancestor`) so the reader keeps the parent context.
The current row itself is ink in every presentation: strong weight in the floating list, the
2px marker in the column. No presentation uses the accent color for location.
Rail marks encode depth by length on one end-aligned axis (`md`, `xs`, `xxs`).
Each title keeps its authored direction inside a `<bdi>` isolate while its row keeps the interface
alignment, so an English title in an Arabic interface reads left to right with its punctuation in
place and the list stays right-aligned. In that mixed case Chromium draws a clamped title's ellipsis at
the interface end of the third line (verified at 834 and 1440, ar).
Authored rich text has heading levels 1–3, so production outlines nest three deep at most; the
changelog uses levels 2–3. Core still handles h1–h6 (DeepNesting). Outline depth is the authored
level: under a document title the body's elements are one level lower (authored H1 renders `h2`, see
[authored heading semantics](token-contract.md#authored-heading-semantics)), but the builders read
the authored levels and the scroll spy follows ids, so the outline is unchanged. Review fixtures
author H1–H3 without skipped levels; their plays assert one `h1` and no skipped level on the page.

## Reading measure

Running text reads at the `contentWidth.reading` role (44rem, `--geul-content-width-reading`), one
width for every language and script (owner decision 2026-10-13; it was 36rem). At the md body size
(16px Noto Sans, line height `line-height-document` 1.7) a full line measures about 92 Latin, 60
Hangul and 120 Arabic characters, spaces included (`typography-audit.mjs measure`, `reading`). In
posts the plain header, running text, series and
comments share one column on the start edge; the hero image keeps its full width and its title starts
and ends with the same column. Legal documents (current, scheduled preview, history detail and share link), the
changelog and work/event details use the same composition: `ContentLayoutView` with
`ContentChrome measure="reading"` for their header (notices, title, metadata, document actions) and
`.prose[data-reading-measure]` (or `LayoutContainer size="reading"` for the changelog list) for the
body. A work featured-image header and an event poster header keep their full-width grids, like the
post hero. Their information order is unchanged; the header → body gap is the shared `md`
document relationship.

| Block (full preview width)                                             | Maximum width      |
| ---------------------------------------------------------------------- | ------------------ |
| Text, lists, quotes, callouts, math, dividers, audio, attachments      | `reading`          |
| Tables, code blocks, Mermaid diagrams                                  | `standard` (62rem) |
| Images, video, standalone external video, maps, p5/three/shader scenes | `wide` (75rem)     |

A block with an authored preview width below 100% stays in the reading column. Breakouts never
exceed the document box, which ends at the outline's reserve.
The measure applies on screen only; paper keeps the print stylesheet's page measure
(`LayoutContainer size="reading"` drops its maximum in print).

### CMS page sections

CMS pages keep their sections' authored widths (`full`, `container` 1200px, `narrow` 800px; an unset
width renders `full`). The reading measure is not a section width option: `narrow` serves bounded text
sections, and the page wire contract (`PageSectionSettings.MaxWidth`) is unchanged.

## Design rules

| Part             | Required behavior                                                                     | Avoid                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Closed rail      | Small neutral marks in the page margin; a distinct current mark                       | A list icon, a persistent title panel, counters or a second long page                              |
| Opening          | Pointer enters the rail; keyboard focus or activation reveals the same outline        | Hover-only access; a detached launcher or search dialog                                            |
| Floating outline | One surface next to the rail, overlaid without moving the article                     | Resizing the article, body scroll locks, modal semantics                                           |
| Long list        | Height limited by viewport and footer; scroll inside the outline                      | Expanding every item down the page; a scrollbar on a tiny closed rail                              |
| Title rows       | Authored text and document order; indentation from actual levels; wrap long titles    | Invented grouping, truncating the only destination name, changing row height on hover              |
| Current section  | Distinct mark and `aria-current="location"`; opening starts the list at the beginning | Automatically centering the current row; overriding manual list scroll                             |
| Closing          | Leave the shared rail/list area; provide keyboard dismissal separately                | Closing solely because a pointer selected a heading; closing between rail and list; trapping focus |
| Small screens    | Reserved layouts show the same rail in reserved space, scrubbable by touch            | A floating button, a bottom sheet or a rail that covers text                                       |

Colors, typography, spacing, boundary, surface, shadow and focus use existing Geul
semantic roles. There are no new palette or theme tokens.
The rail is decorative inside one named focusable entry. Dense documents bound only
the number of decorative marks (48); the current indicator uses full-document position.
Every source heading remains in the outline. Decorative marks are not tiny link targets.
The expanded rows keep the Core compact/coarse-pointer minimum.
The maximum 20rem rail and 28rem outline are component geometry, not external standards.

The Geul outline owns vertical scroll and contains overscroll. Wheel
containment is a Geul acceptance requirement, not a verified Notion finding. Its inner
padding keeps the first/last row and focus outline clear of the edge. Opening starts
the list at the beginning without moving the page. Subsequent page scroll updates
current meaning but must not override manual outline scrolling.

## Public contract and content

Props are `items: TocItem[]`, `title`, `children` (required: the document the outline navigates)
and `outlinePresentation` (`responsive` default, `rail` beside another column).
`hasTableOfContents(items)` exposes the threshold and `tableOfContentsScope` marks the ancestor
that shares the reserved insets with outside chrome. Items remain `{ id, label, level }`. IDs must
match rendered headings in document order.
Keep the existing omission for three or fewer headings.
Do not pass a rail subset back to the document or change authored labels with the UI locale.
There are no arbitrary size, color, maximum-heading-count or style override props.

The outline contains native links. Modified activation preserves browser link behavior.
Selecting a target moves focus to its heading and scrolls with the reduced-motion preference.
A temporary tabindex is removed on blur. Missing targets do not shift current indices.
Heading lookups are cached. Active-section tracking uses a binary lookup in vertical
geometry order, refreshed on content resize. The visible outline retains authored
reading order, including headings in page columns.
At the document end the last heading becomes current even if its short section
cannot scroll all the way to the reading line.

The rail exposes its localized name, expanded state and controlled list.
Tab reaches the rail and reveals the list; ArrowDown/keyboard activation enters the first entry.
Tab navigates real links. Escape closes and returns focus to the rail.
Keyboard activation closes the list after moving focus to the heading. Pointer selection
keeps it open while the pointer remains inside. Keyboard focus can keep it open after
pointer exit so focused links are never hidden. These are Geul keyboard extensions;
native Notion keyboard behavior was not verified.
No menu roles, modal backdrop or focus trap are used.
Theme changes use the existing semantic roles. Heading language stays authored.

## User scenarios and acceptance

| ID     | Scenario                            | Steps                                                                 | Expected result                                                                                                                    | Story / consumer                                                              |
| ------ | ----------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| TOC-01 | Read without interruption           | Open a normal document; scroll the article                            | Only compact marks; current position changes; article width and scroll remain stable                                               | Default; PostView/PageView                                                    |
| TOC-02 | Inspect destinations                | Enter rail, then move into floating list, then leave                  | One adjacent list; no hover gap; close only after leaving both                                                                     | Default                                                                       |
| TOC-03 | Browse a long outline               | Open 60/120 entries; scroll to the bottom                             | List stays within viewport; last entry reachable; article does not scroll; wheel does not chain into article                       | LongDocument; ManyTopLevelSections                                            |
| TOC-04 | Reopen after navigation             | Navigate to a middle section, leave and reopen                        | List begins at the start; current meaning preserved; no forced list movement while browsing                                        | LongDocument                                                                  |
| TOC-05 | Navigate to a distant section       | Select a late heading from the outline                                | Actual heading receives focus; pointer selection keeps the outline open while the pointer remains inside; reduced-motion respected | LongDocument; post/page fixtures                                              |
| TOC-06 | Use keyboard only                   | Tab to rail; ArrowDown; Tab between entries; Enter; reopen and Escape | Visible focus and readable names; heading focus on selection; no focus trap; Escape returns to rail                                | KeyboardNavigation                                                            |
| TOC-07 | Read long and nested titles         | Open a mixed H2/H3/H4 outline with a long name                        | Titles wrap; hierarchy remains based on levels; no horizontal scrollbar                                                            | LongLabels                                                                    |
| TOC-08 | Change theme and UI language        | Select Korean/English and light/dark/custom themes                    | Rail, surface, text and focus use current theme; title stays authored; navigation name localized                                   | All examples                                                                  |
| TOC-09 | Reach footer / short viewport       | Open at the top; scroll to footer; inspect a short-height viewport    | Column/list fit the first screen below the title; the outline ends with the document box; internal scrollbar exposes all entries   | FooterBoundary; MouseNavigation                                               |
| TOC-10 | Use mobile/tablet page              | Inspect 390px and 834px                                               | The rail sits beside, never over, the text; no floating button                                                                     | PhoneRail; MediumRail                                                         |
| TOC-12 | Read on a wide screen               | Open a long post at 1280–1920; scroll                                 | Persistent column beside the reading column; ink marker follows; current row stays visible in a long column                        | ReadingColumn; PostLongDocument                                               |
| TOC-13 | Scrub on a phone                    | Press the rail, drag vertically, release; repeat and drag sideways    | Highlighted heading follows the finger; release navigates and focuses the heading; sideways/cancel does not navigate               | ScrubNavigation; PhoneRail                                                    |
| TOC-14 | Read nested sections                | Open an h2–h6 outline with long titles; scroll to a deep section      | Nested list; indentation capped at three steps; titles wrap/clamp; parents of the current row shown in ink                         | DeepNesting                                                                   |
| TOC-15 | Align document chrome               | Hero/plain post and untitled page with a language menu at 390–1920    | Title and first body line share a start edge; document controls end before the outline column                                      | PostHeroLongDocument; PageLongDocumentUntitled                                |
| TOC-16 | Read legal, changelog, work, event  | Open each long document at 390–1920, light/dark, ar; print A4         | Reading column on the start edge, outline at the end, same header order; paper has no outline                                      | TermsLongDocument; ChangelogLongDocument; WorkLongDocument; EventLongDocument |
| TOC-11 | Document changes or IDs are missing | Replace items; supply a missing target                                | Three-or-fewer clears navigation; pending work cleaned up; remaining heading indices intact                                        | Core unit tests                                                               |

## Verification and migration

The rejected list-button/search/collapse-panel draft is superseded.
Existing Feature props, heading data and routes require no migration.
Pointer scrubbing returned on 2026-10-13 as an owner-approved enhancement of the rail only;
the revealed list still uses ordinary links. Do not treat condensed decorative marks as
independent touch targets: the whole rail is one target that maps position to heading.

Removing the standalone rail is a breaking Core change: `children` is required and `footerSelector`
is gone. Every consumer was migrated (see the changelog); a new consumer passes its document as
children. The legal editor
preview renders the body without an outline.

Run `node scripts/design-system/review.mjs run toc-navigation`.
Browser screenshots and observations must identify exact scenarios, viewport, theme,
locale and production View fixture. Automatic tests and visual checks are separate.
The review examples stay at their initial position for manual inspection. Dedicated
MouseNavigation, KeyboardNavigation, ScrubNavigation, ReadingColumn and DeepNesting examples
run automated scenarios. The Storybook test runner uses a 1280px page, so those plays assert the
column presentation there (links, focus order, fit to the first screen, aria-current) and the rail
behavior below `lg`; rail scrubbing in the browser is covered by the 390/834 review captures and
by Core unit tests. LongDocument, ManyTopLevelSections, LongLabels, FooterBoundary, MediumRail and
PhoneRail are manual review surfaces; Storybook's viewport toolbar sets their width.
Production consumers are Pages / Public / Documents / PostLongDocument, PostHeroLongDocument,
PageLongDocument and PageLongDocumentUntitled; Pages / Legal / Public Document /
TermsLongDocument; Pages / Public / Utilities / ChangelogLongDocument; Pages / Public / Entity Detail /
WorkLongDocument and EventLongDocument. Review evidence (plans, before/after captures, A4 PDFs) is in
`.artifacts/design-system/reviews/toc-followups/`.
PageContentView now connects its rendered rich-text sections and nested columns to
the same navigation owner; that production connection was previously missing.
Those two examples include the production ShellView through its existing Storybook
harness, with local navigation and footer data. They do not call the server Shell controller.
Local fixtures establish Core/View behavior, not backend persistence, physical touch
or native VoiceOver/Orca acceptance. Read the recorded review for executed scope.

## Print omission

The rail and column are screen chrome. `TableOfContents.module.css` hides them, removes the
reserved inline space and sets the published insets to 0 under `@media print`, so chrome outside
the layout prints on the page measure too; global print styles (`lib/styles/print.css`) must not
select the generated CSS-module class (such as `TableOfContents_wrapper`) or reserved Core markers.
