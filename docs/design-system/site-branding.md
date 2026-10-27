# Site branding and header composition

Core `ApplicationFrame/SiteHeader` owns the public header grid, shared insets and responsive placement.
`ShellLayout` supplies the site logo link, navigation toggle, search, language, theme and account actions.
Pages consume that shell; they do not position their own copies of header controls.
Below `sm` the menu toggle opens Core's phone navigation panel: a `nav` named by `navigationLabel` that
fills the screen below the header. The header stays in place, so the brand keeps its position and is
not repeated in the panel, and the toggle that opened it (now a close glyph) closes it. While open,
the page behind is inert and does not scroll, Escape closes it and returns focus to the toggle, and
the panel covers the consent banner while staying below popups such as its language menu.

Below the shared `sm` breakpoint, the menu toggle is visible and equal flexible tracks keep the brand
at the center of the header viewport. The theme toggle sits beside the menu toggle; search and account
occupy the opposite track. Both groups hold two controls (signed-in: two icons; anonymous: an icon and
the "Sign in" text), so the space on either side of the brand stays close to even down to 280px.
The group widths do not change the brand center, but uneven groups leave visibly uneven space at
320px, so keep `mobileLeadingActions` about as wide as `mobileActions`. The language menu is not in the
phone header: it is the last row of the navigation panel (`LanguageMenu variant="navigation"`, a
full-width row matching the panel links) and remains in the mobile footer. At `sm` and above, the
brand sits at the start beside the desktop navigation/actions. This uses the same breakpoint as Core
`MenuToggle` and the navigation panel, including narrow windows on desktop computers; widening past it
closes an open panel.

Use `SiteHeader` in the `header` slot of `ApplicationFrame kind="site"`. Pass semantic content through
`logo`, `navigationToggle`, `mobileLeadingActions`, `mobileActions` and `desktopActions`. Styling props
and arbitrary inset/width overrides are rejected. Core buttons, icon buttons, navigation links and
menus continue to own interaction geometry, focus and hover states. No new visual tokens are added.

## Logo slots

Site settings store six logo slots, each with a light and a dark variant:

| Slot                                     | Artwork                         | Used by                                                                 |
| ---------------------------------------- | ------------------------------- | ----------------------------------------------------------------------- |
| `logo_full_light` / `logo_full_dark`     | Symbol with wordmark            | Public header (all widths), expanded admin navigation, forms, OG images |
| `logo_symbol_light` / `logo_symbol_dark` | Symbol only                     | Compact admin navigation rail, print watermark                          |
| `logo_email_light` / `logo_email_dark`   | PNG (SVG uploads are converted) | Email layouts (`{{logo_email_url}}`, `{{logo_email_dark_url}}`)         |

The API resolves display fallbacks once for every consumer: a missing theme uses the other theme of the
same form, then the other form. `SiteLogo form="full" | "symbol"` reads the resolved manifest pair, so
consumers never repeat the fallback. Email logos fall back across themes only. Admin settings show the
stored slots without fallbacks, each previewed on the theme background it is drawn for
(`ImagePreviewFrame surface="theme-light" | "theme-dark"`). OG images always use the full light logo and
print uses the light symbol (paper and the OG renderer are light).

`SITE_LOGO_HEIGHT` (`features/site/SiteLogo/placements.ts`) owns the image heights. The full logo is drawn
at its own size (`'intrinsic'`) in the public header, expanded admin navigation and form pages: the site
sizes it by the `width`/`height` attributes of the uploaded SVG. Core `SiteHeader` caps the brand at the
header height less `--geul-spacing-xxs` above and below (44px on phones, 56px from `sm`); elsewhere
`SiteLogoView` caps an intrinsic logo at `--geul-chrome-header-height-sm`. An SVG with only a `viewBox`
has no size of its own and grows to that cap, so upload full logos with explicit `width` and `height`.
The symbol keeps fixed heights: compact admin rail 28px, print watermark 18px. These are proportional
image dimensions, separate from control/text sizes. `SiteLogoView` prevents image flex shrink; the admin
navigation's header remains outside its shrinking, scrollable navigation list.
In expanded admin navigation the logo and subtitle start on the navigation labels' `xs` line. The
image box is aligned, not the artwork: clear space inside an uploaded SVG's viewBox shifts the visible
mark. Upload logos whose viewBox is trimmed to the artwork so the mark itself sits on that line.

Rawsector uploads one red label for both themes: the stacked logo on its red field at 56px high as the
full logo, and the simplified symbol on a 28px red square as the symbol. The files and their vector sources
live in `/Volumes/dev/rawsector` (`logo/site/`); the source vectors are not duplicated into the product
repository. The `StackedBrand` stories use copies of those two files from `tests/fixtures/media`.

Preview the actual Views at `Pages/Application/Frames`: `StackedBrand`, `StackedBrandAdmin` and
`StackedBrandAdminCompact`. Review light/dark, 280/320/390/767/768/1280px, anonymous/authenticated,
menu open/close, keyboard focus and admin navigation expansion. Storybook mocks session/route data;
it does not prove live authentication, asset settings persistence or deployment.

## Migration

Public shell composition moves from a Feature-local row to Core `SiteHeader`. Existing `ApplicationFrame`
header slots remain compatible. Other header consumers should use this composition when they need
the same hamburger/centered-brand contract, and supply content through slots instead of CSS overrides.
