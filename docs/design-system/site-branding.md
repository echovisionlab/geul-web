# Site branding and header composition

Core `ApplicationFrame/SiteHeader` owns the public header grid, shared insets and responsive placement.
`ShellLayout` supplies the site logo link, navigation toggle, search, language, theme and account actions.
Pages consume that shell; they do not position their own copies of header controls.
The mobile navigation drawer receives the same branded `SiteLogo` through Core
`ApplicationFrame.navigationTitle`; Core preserves `navigationLabel` as the accessible heading name.
Consumers without branding keep the existing `navigationLabel` text heading.

Below the shared `sm` breakpoint, the menu toggle is visible and equal flexible tracks keep the brand
at the center of the header viewport. The theme toggle sits beside the menu toggle; search and account
occupy the opposite track. Both groups hold two controls (signed-in: two icons; anonymous: an icon and
the "Sign in" text), so the space on either side of the brand stays close to even down to 280px.
The group widths do not change the brand center, but uneven groups leave visibly uneven space at
320px, so keep `mobileLeadingActions` about as wide as `mobileActions`. The language menu is not in the
phone header: it is the last row of the navigation drawer (`LanguageMenu variant="navigation"`, a
full-width row matching the drawer links) and remains in the mobile footer. At `sm` and above, the
brand sits at the start beside the desktop navigation/actions. This uses the same breakpoint as Core
`MenuToggle` and the navigation drawer, including narrow windows on desktop computers.

Use `SiteHeader` in the `header` slot of `ApplicationFrame kind="site"`. Pass semantic content through
`logo`, `navigationToggle`, `mobileLeadingActions`, `mobileActions` and `desktopActions`. Styling props
and arbitrary inset/width overrides are rejected. Core buttons, icon buttons, navigation links and
menus continue to own interaction geometry, focus and hover states. No new visual tokens are added.

The public `SiteLogo` uses an authored 48px image height within the existing 52px/64px header.
The admin controller supplies 80px expanded and 40px compact image heights instead of the previous
14px/12px values. These are proportional image dimensions, separate from control/text sizes.
`SiteLogoView` prevents image flex shrink; the admin navigation's header remains outside its shrinking,
scrollable navigation list. The logo's own artwork proportions and clear space remain intact.
In expanded admin navigation the logo and subtitle start on the navigation labels' `xs` line. The
image box is aligned, not the artwork: clear space inside an uploaded SVG's viewBox shifts the visible
mark. Upload logos whose viewBox is trimmed to the artwork so the mark itself sits on that line.

Rawsector uses the Illustrator media kit's stacked symbol-over-wordmark artwork for both themes.
The editable authority remains `/Volumes/dev/names/branding/media-kit/rawsector.ai`. The SVG paths
and 1024-square viewBox are unchanged; upload copies declare 48px intrinsic dimensions. The source
vectors are not duplicated into the product repository. Brand stories reference published CDN assets.

Preview the actual Views at `Pages/Application/Frames`: `StackedBrand`, `StackedBrandAdmin` and
`StackedBrandAdminCompact`. Review light/dark, 280/320/390/767/768/1280px, anonymous/authenticated,
menu open/close, keyboard focus and admin navigation expansion. Storybook mocks session/route data;
it does not prove live authentication, asset settings persistence or deployment.

## Migration

Public shell composition moves from a Feature-local row to Core `SiteHeader`. Existing `ApplicationFrame`
header slots remain compatible. Other header consumers should use this composition when they need
the same hamburger/centered-brand contract, and supply content through slots instead of CSS overrides.
