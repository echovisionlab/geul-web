# Design system changes

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
