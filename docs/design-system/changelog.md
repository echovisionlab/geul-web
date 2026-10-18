# Design system changes

## 2026-10-18 — start-edge documents and one media scale per item size (unreleased)

Posts, legal documents and the changelog start at the start edge like entity details and pages: title, hero
text and running text share that edge and the outline sits at the inline end. Core `TableOfContentsView`
loses `contentPlacement` (the `center` placement and `--_table-of-contents-inset-start` are removed); Core
`LayoutContainer` gains `placement="start"`. The persistent outline column's rows move from `sm` to `xs`.
Core Collection has five item sizes (XS–XL, contracts 0.11.0 appends `xs`/`xl`) and Core `LayoutGrid` five
minimum column widths (7/10/14/20/28rem, a √2 scale). A collection thumbnail takes the minimum grid card width of its size (at
most 40% of a narrow row), so list and grid blocks of one size show images at the same scale and a 16:9 thumbnail
is no longer shorter than its title and metadata. New semantic token `text-hover` is the one hover ink of quiet
navigation (NavigationLink secondary/muted tones, Tabs, SideNavigation, outline rows); a Core test rejects hover
rules that name a text role. Outline column rows rest in `text-muted` and show `text-hover` on `surface-hover`
with a `border-strong` rule segment under a pointer; the current row also takes medium weight. Root `word-break:
keep-all` now applies in every interface language (Japanese and Chinese opt out), so Korean titles on English pages
no longer break inside words. Collection grids keep exact track widths from `md` (`LayoutGrid columnGrowth`), and
phone list thumbnails are square.

## 2026-10-17 — authoring settings column (unreleased)

`DocumentEditorPanels` puts the settings in a sticky, independently scrolling column beside the body from
`lg` (tabs below `lg`; the body bleeds to the edge on phones only). Event, Release and Series adopt it with
Post, Page and Work. New Feature `EditorSettingsSection` is the settings card; all editors order their cards
URL → details → classification/related → credits → options → summary → images → metadata → sharing →
translations. Release's bordered "Basic Information" box, Event's bordered "Body" box and untitled relation
card, and Work's loose location/image grid become standard cards; Work's type-specific group labels move
from `xs` to `sm` so they no longer read smaller than the fields they group.

## 2026-10-17 — public details, fluid collections and continued lists (unreleased)

New Feature `EntityDetailLayout` / `EntityDetailSection` / `EntityDetailImage` (document-layout) give every
public entity detail one full-width composition: media in the start third from `md` (sticky), title, metadata
and h2 sections beside it, stacked below `md`. Event, Work, Release, Artist, Label, Series and Event series
adopt it; their ad hoc `role="heading"` labels, Work's `WorkPublicHeaderLayout` and Release's fixed 280px
artwork column are removed. Work keeps its paper overlay header through `printMedia="overlay"`. `CreditList`
no longer prints its own title.

Core `LayoutGrid` adds `minColumnWidth` (`sm`/`md`/`lg`, responsive): a fluid grid of equal columns at least
that wide. Page collection blocks size columns from the item size instead of the authored count, which now
applies to carousels only (the editor shows "Slides to show" for carousels and no column control otherwise).
Stacked page sections now share the `xl` rhythm on screen as on paper, so a heading block no longer sits
flush against the collection before it; adjacent sections with a background colour stay joined.
Core `TableOfContentsView` adds `outlinePresentation="rail"` for documents sharing the page width. Core
`Pagination` and server table pagination render nothing for a single page. Collection blocks with pagination
on continue in place (`InfiniteItems`, Load more / retry) instead of page links.

## 2026-10-17 — admin page outline (unreleased)

Every admin page now has exactly one h1 at the page title scale, followed by h2 sections. Mail adapters,
Menus, Translation overview/jobs/settings and the dashboard move from hand-built `Heading level={2}` rows to
Core `PageHeader`; settings-style sections use `SettingsSection` without cards, and cards remain only for
repeated objects (mail adapters, translation providers). User edit renders Profile, SSO providers, primary
email, ban state and the personal access token as h2 sections; the profile Save sits at the end of the
Profile section, whose description states that the following sections apply immediately.

Core `TextInput textRole="title"` drops its inline padding and uses the page title scale at `size="xl"`,
so editable editor titles (post, page, email, map theme) match read-only titles. Core `SelectionPath`
adds `pageTitle`, rendering the current location as the h1; the admin file manager uses it instead of a
label-sized "Files". `LogoCropper` (client and label logos) no longer repeats its visible label inside the
empty dropzone, previews each variant on its theme surface, and the light/dark pair sits side by side
from `sm`.

## 2026-10-17 — settings hierarchy, logo slots and upload previews (unreleased)

Core `SectionHeader` adds `level={2 | 3}`: real headings on one scale (page title → section → group →
field label). Without a level it keeps the compact card/row label. New Core `SettingsSection` (level 2,
`lg` rhythm) and `SettingsGroup` (level 3, `md` rhythm) compose settings pages; admin Site settings and
OG image settings adopt them with Core `PageHeader`. Section-level fields precede groups.

Core `ImagePreviewFrame` adds `surface="theme-light" | "theme-dark"`, backed by the new invariant tokens
`theme-light-background` and `theme-dark-background`, so theme-specific artwork previews on its own
background in either app theme. `ImageUploadField` hug previews size the remove action's box to the
image, and the outside remove action is a corner badge: `IconButton placement="overlay-end"` centres an
opaque chip on the media's top-end corner, and `ImageUploadField` reserves half the control as a gutter
so the badge never covers adjacent text.

Site logos become full/symbol/email slots with light and dark variants (see `site-branding.md`). The OG
background moves from Site settings to OG image settings.

## 2026-10-17 — site header and brand placement (unreleased)

Core `ApplicationFrame` exports `SiteHeader`, a closed slot composition that centers branding whenever
the responsive menu toggle is visible. Public `ShellLayout` adopts it. Phone header groups are
balanced: menu + theme at the start, search + account at the end, so the centered logo keeps even
space down to 280px. The language menu moves from the phone header to the navigation drawer's last row
(`ShellViewSlots.languageMobile` is replaced by `languageNavigation`; `LanguageMenu` adds
`variant="navigation"`).
Core `ApplicationFrame.navigationTitle` optionally supplies a branded drawer heading; the public
shell uses the same logo there, while the text heading remains the fallback.

The existing Core chrome/spacing tokens and control variants are unchanged. `SiteLogoView` preserves
image flex size; public and admin consumers use explicit authored dimensions. Admin navigation keeps
its branding header outside the scrollable list's shrinking space.

Core `Disclosure` adds `density="chrome"`: compact geometry with the label on the chrome rows' `xs` line,
so navigation groups start where chrome links start. Core `SideNavigation` expanded groups now render this
Disclosure (sentence-case label, trailing turning chevron, no rules between expanded groups) instead of the
uppercase section header; items, the active boundary and the compact rail are unchanged. The public mobile
drawer groups move from `compact` to `chrome`, fixing a 4px label offset against sibling links. Admin
navigation branding and subtitle start on the same `xs` line as the navigation labels.

Console-clean Core contracts: `Field` names its child through aria-labelledby as well as `<label for>`;
`Tooltip` keeps React Aria's open state controlled for the trigger's lifetime (suppression no longer flips it
between controlled and uncontrolled); `SegmentedProgress` segments are labelled `img` tooltip targets; new
`DropdownMenu.Anchor` replaces hidden `DropdownMenu.Target` divs for context menus (file manager, editor file
picker). Feature fixes: unlabeled inputs gain aria-labels (form password, email test recipient, AI prompt),
non-control tooltip targets carry roles (participant role badge, track audio status).

Usage, migration and verification scope: [site branding](site-branding.md).
