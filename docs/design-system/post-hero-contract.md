# Public post hero and reading flow

## Scope and ownership

`features/post/PostHeader/PostHeader.tsx` owns the post-specific title, featured image,
authors, location and taxonomy. `features/post/PostViewContent.tsx` composes the same
header with generated authored body blocks, series navigation and comments.
`stories/pages/PublicDocuments.stories.tsx` renders these production owners together.

The system definitions consumed by this pattern are Core `MediaImage`, `ImageChrome`,
`Heading`, `PublicMetadataRows`, `PublicMetadataValueGroup`, `UserInlineLinks`, `IconButton`
and `LayoutInset`, plus the Core heading `title` role and the document-layout `ContentLayoutView`.
No new token, feature color, type scale or control skin is introduced.

## Geometry and hierarchy

The featured image stays within the document's available inline width. This pattern does
not assume that a parent supplies padding to cancel with a negative margin. Authored
image selection, cover fit, managed-image preset and existing alternative text are retained.
The current post model supplies no separate featured-image credit or focal-point field;
this pattern does not invent or discard such metadata.

The image fills the hero's growing geometry. Its minimum height remains 232px below
`sm` and 400px at `sm` and above: these are existing media geometry choices, not new
interface spacing tokens. The title and metadata use normal flow through Core
`ImageChrome`; a separate decorative cover consumes the existing Core header shade across
the whole photo. Long titles and additional metadata can
increase the hero height instead of overflowing an absolutely positioned content layer.

One action row holds edit, Markdown export and the content language menu (`languageControl`)
with the Core `action-group` gap (8px), centered on one axis. On the hero it sits at the
`md` inset of the top trailing edge, with its space reserved in the flow; on the plain
header it is centered on the title's first line box without enlarging it. The language
menu is no longer an absolutely positioned layout control with a fixed 4.5rem reservation,
so longer locale names cannot overlap the export command.

The post title consumes the Core heading `title` role (`scale="title"`: 32px below `sm`,
40px at `sm` and above, 22pt on paper), the same title size as Page chrome and public document
details, and at least one text-scale step above an authored body `h1` at every width.
Title → metadata is 16px in both headers (`xs` gap plus the rows' own `xs` offset), the
shared public detail relationship. Plain and hero headers render the same metadata rows,
including collaborators; only the tone follows the surface. Collaborators, categories and
tags use `PublicMetadataValueGroup separator="slash"`, the same grammar as the author list.
The authors label centers with its avatar-height value.

Title and body share the Core `md` inline inset. `ContentLayoutView` owns the single `md`
gap between document chrome (plain header, hero or Page title) and the body, on screen and
paper; consumers no longer add their own block-start inset. Plain posts retain their
existing available inline width. The authored body carries its content `lang` and the
matching `dir`; series previous/next glyphs follow the interface direction.

The title shares the body's reading column at every width. The body sits in the space the table of
contents reserves (`--_table-of-contents-inset-start`/`-end` from the `ContentLayoutView` scope: 0
without an outline, the rail on the inline end below `sm`, both sides from `sm`, the column track
from `lg`) and centers the reading measure there; the hero content pads its title by the same insets
plus the centered remainder, and the plain header uses `ContentChrome measure="reading"`. Title and
first body line therefore share their start edge from 390 to 1920px, with and without an outline and
on coarse pointers (the 2026-10-13 review measured 14–22px drift at 640–767px before this).

## Use and avoid

Use the hero when a post has a featured image. Render the same header without hero
geometry when no featured image exists. Keep the actual authored body in the preview:
an isolated photograph does not show the reading transition or alignment.

Do not stretch the photo beyond the content container, repeat document padding as a
negative margin, place long metadata inside a fixed absolute cover, float controls over the
header with a fixed reservation, or change authored image meaning to make a fixture look cleaner. Product controls use Core inverse contrast
inside image chrome. Body content continues to use the selected theme's normal surface.

## Review stories and checks

- `Pages/Public/Documents / PostHero`: image, metadata, locale control and real body.
- `PostHeroLong`: long title, multiple authors and long taxonomy content.
- `PostHeroPhone` and `PostHeroTablet`: the same long content at named device viewports.
- `Post` and `PostEmpty`: plain and empty bodies remain independent states.

Hero plays measure image/container edges, title bounds, title/body inline alignment,
block spacing and absence of document-wide horizontal overflow. They wait for the real
fixture image to load. The focused source tests preserve image URL/alternative text,
author identity links, full metadata and print fragment behavior.

Review Light/Dark and custom Light/Dark presets in English, Korean and Japanese.
At mobile, tablet and desktop widths, inspect all metadata, the top actions and the first
body heading together. Check that long content increases height and the locale control
does not overlap export/edit commands. Printed output, native screen-reader reading and
service-backed export/media responses require their own execution evidence.

The local story uses a bundled poster and fixed English authored body. Locale selection
changes interface and localization metadata, not the fixture's authored translation.
Comments and Markdown responses are local fixtures. Browser checks do not establish
backend authorization, live image delivery, publication or signed-download behavior.

## Print

Paper keeps the screen composition. The hero prints as one unbroken fragment (minimum
62mm, `print-color-adjust: exact`) under the same header shade, without an extra image
filter; its inverse title keeps inverse ink because the global heading ink rule skips
`data-tone="inverse"`. Header actions, the language menu, series previous/next links,
comments and the table of contents are print-hidden; the series name and part remain.
Every theme (including dark and custom presets) prints with the light semantic roles on the
paper surface. Review with `Pages/Public/Documents / PostLongDocument` (shell, print
header), `PostHeroLong` and `PageLongDocument` under emulated print media and `page.pdf`.

## Compatibility

`PostHeader` replaces `reserveLanguageMenuSpace?: boolean` with `languageControl?: ReactNode`;
its only consumer, `PostViewContent`, passes the content language menu there instead of
`ContentLayoutView controls`. The featured-image data model is unchanged. The visual change
removes parent-dependent bleed, allows hero content to grow, aligns the action row, enlarges
the post title to the shared document title scale and moves the chrome → body gap into the
document layout. Production and Storybook consume the same updated owners.
