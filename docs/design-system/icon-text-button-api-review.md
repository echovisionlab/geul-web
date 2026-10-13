# IconButton and TextButton follow-up review

Reviewed: 2026-10-12. Status: code-contract and Storybook review draft.
Scope: API, states, semantics, glyph boxes and long indicator labels for both Core components. The code reviewer did not operate a browser.
Earlier behavior corrections and type contracts are recorded in the [Button family review](button-api-review.md).

## Criteria and actual contract

[Carbon Icons](https://www.carbondesignsystem.com/building-blocks/foundations/icons/guidelines) informs the comparison of a 16px artboard, centered icon/text alignment and a minimum 44px touch target.
[Carbon Button accessibility](https://www.carbondesignsystem.com/building-blocks/core/components/button/accessibility) requires hover/focus guidance for icon commands and Tab/Enter/Space activation.
[Carbon Button guidelines](https://www.carbondesignsystem.com/building-blocks/core/components/button/guidelines) informs long-label wrapping and the distinction between commands and navigation. Carbon enums, fills and padding are not copied.

Authority: [IconButton](../../components/core/IconButton/IconButton.tsx), [TextButton](../../components/core/TextButton/TextButton.tsx),
[Control CSS](../../components/core/Control.module.css), [TextButton CSS](../../components/core/TextButton/TextButton.module.css) and the [spacing/icon contract](spacing-icon-contract.md).

| Concern              | Reviewed contract / decision                                                                                                                                                                                                                                                            |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ordinary commands    | neutral/medium; supporting commands use low. Existing IconButton neutral/low defaults were not changed indiscriminately without classifying roles                                                                                                                                       |
| Supporting consumers | FileBrowserViewToggle uses SegmentedControl icon options; FormattingButtons uses Core-owned IconButton `pressed`; ToolbarCommand defaults to low in supporting toolbars. No incorrect low ordinary command was found in this scope                                                      |
| IconButton name      | Exactly one of label / aria-label / aria-labelledby. Callers ensure external IDs exist. count is decorative; names/descriptions convey business meaning                                                                                                                                 |
| IconButton state     | Ordinary actions retain focus and block activation while pending. Pending replaces glyph/count with a named spinner and restores them afterward. disabled is native disabled. The drag-handle has a separate sensor contract; pending/disabled uses native disabled and blocks dragging |
| TextButton semantics | href renders an anchor; actions render native buttons. selected is visual ancestry; callers supply aria-current/pressed/expanded. No loading API                                                                                                                                        |
| TextButton defaults  | appearance default maps to neutral/medium, muted to low. Typography and control geometry are distinct. nowrap defaults to false; indicator follows the label                                                                                                                            |
| API escapes          | Existing types reject arbitrary style/className/framework props and control sizes, submit/form props on links, and indicators on links                                                                                                                                                  |

## Glyphs and optical space

IconButton padding is 0. Layout targets are compact 28px / xs 30px / chrome 32px, with a coarse-pointer minimum of 44px. The SVG frame stays at the 16px chrome-icon-size role.
Original Tabler 24×24 viewBox paths and live areas are preserved. SVG internal space, unused control target space and parent gaps are distinct measurements, not additive CSS padding.
Different close/menu/plus widths did not justify common scaling or cropping. The [spacing/icon contract](spacing-icon-contract.md) distinguishes path calculations from browser measurements.

[OpticalGlyphComparison Story](../../components/core/IconButton/IconButton.stories.tsx) compares close/menu/plus at compact/xs/chrome sizes. Short visible Tooltip copy and the target-specific accessible name are supplied separately.
This is a glyph-geometry example, not approval of real close/add/menu tasks. Original glyph and token sources were unchanged.

## Reproduced defect and scoped correction

TextButton with nowrap=false and an indicator still inherited common Control .label white-space:nowrap / ellipsis, contradicting its API and long-menu-label behavior.
TextButton now owns normal wrapping and overflow-wrap through its label class; nowrap=true retains the original single-line ellipsis. The shared .label rule for other Core components was unchanged.

Consumers: [ShellView](../../features/shell/ui/Shell/ShellView.tsx), [LanguageMenu](../../features/shell/LanguageMenu.tsx) and [LocationPlaceMenu](../../features/location/LocationPlaceMenu.tsx). Locale names, place names and navigation labels consume this indicator contract.
An explicitly nowrap Layout supplied by a caller retains its own composition reflow contract.

[LongMenuLabel / LongMenuLabelNoWrap Story](../../components/core/TextButton/TextButton.stories.tsx) compares real DropdownMenu triggers within 240px. The full accessible name and expanded/menu relationship remain; indicator is decorative.
The long English label is an authored fixture, not a check of every translation's length.

## Pending glyph correction

A reviewer identified the original glyph overlapping the spinner in pending Core IconButton. Local content retained children/count while adding ProgressBar.
Pending now removes the original glyph and decorative count, rendering only the named ProgressBar. Root, size, target, action name, busy state and duplicate-activation blocking remain. Glyph/count return after completion; PendingTransition demonstrates this transition.

PendingTransition restores idle after a three-second mock operation; PendingWithBadge is static pending.
Before correction, two action/drag-handle regressions failed because SVG content remained. Tests cover names, progress naming, size contract, duplicate blocking and idle restoration, not browser CSS pixel geometry.
The follow-up run passed IconButton/TextButton/ToolbarCommand: 3 files / 43 tests, the Core type suite and ESLint for three changed IconButton TS/TSX files. Stylelint was not rerun because common CSS and tokens were unchanged.

## Executed checks and remaining scope

The earlier runtime run passed IconButton / TextButton / ToolbarCommand: 3 files / 41 tests. Two added nowrap false/true cases check full names, decorative indicators and expanded/menu relationships.
The Core type fixture suite and TextButton CSS stylelint passed. ESLint --max-warnings=0 passed for four changed TS/TSX files, with 0 errors / 0 warnings.
jsdom does not verify actual wrap height, path bounds or touch geometry. Browser review must separately measure LongMenuLabel height/indicator placement, NoWrap single-line behavior, SVG frames/path spans, targets, padding and parent gaps.
Hover/focus Tooltip, disabled/pending/pressed, light/dark, locales and viewports remain browser-review items.

IconButton does not automatically copy its accessible name into a visual Tooltip. Carbon's hover/focus guidance must be reviewed in compositions such as ToolbarCommand and actual consumers.
This record does not approve all icon-only tooltips or VoiceOver/Orca integration.

## Baseline and change scope

Twelve dirty files in the two directories were copied and SHA-256 recorded first.
Local records: `/tmp/geul-icon-text-review-before.json`, `/tmp/geul-icon-text-review-before/`.
Scoped diff: `/tmp/geul-icon-text-review.patch`; before/after hashes: `/tmp/geul-icon-text-review-changes.json`.
Changes covered TextButton source/CSS/test/Story, IconButton source/test/Story and this document. Shared Control CSS, tokens and generated artifacts were unchanged.
The pending follow-up baseline and original copies are separately preserved in `/tmp/geul-icon-pending-before.json`. Its scoped diff is `/tmp/geul-icon-pending-review.patch`.
