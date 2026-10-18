# Design token audit

This report is generated from production source by `node scripts/design-system/check-tokens.mjs --report`. Regenerate after source changes. Current source findings do not certify every visual state.

## Current measured scope

- 2431 production CSS/TS/TSX files scanned under app, components, features and lib, plus the central theme.ts.
- 214 known semantic and font tokens in shared CSS definition files.
- 0 remaining interface/runtime literal color occurrences in 0 files, excluding central definitions and the authored-color exceptions below.
- 0 remaining authored editor palette literals in legacy variables.css. Their exact document colors belong to the shared authored palette source.
- 20 authored editor color definitions are owned by the shared token source and generated into the same durable document roles.
- 0 existing literal CSS spacing/typography occurrences covered by the migration baseline.
- 0 existing custom-property declarations/inline assignments outside central files (private `--_*` implementation variables are permitted).
- 177 literal CSS dimension occurrences in spacing, typography and geometry properties; 71 distinct values. These are audit findings, not blanket errors: canvas dimensions, geometry and responsive layouts require context.
- 767 CSS custom-property declarations, 295 distinct names, 143 names declared more than once. Theme/state/media overrides are expected; equal values alone do not establish semantic duplication.
- 0 findings match the reviewed migration baseline; 0 new violations; 0 obsolete baseline keys eligible for removal.

## Enforcement contract

Run `node scripts/design-system/check-tokens.mjs` (or `pnpm design-system:check`) in CI. New literal colors, CSS spacing/typography values and non-private custom-property definitions fail relative to an occurrence-count baseline. Adding another occurrence of an old color fails. Editing a literal color or spacing value in place also fails. Line movement does not change approval. Existing custom properties may change initializer to migrate to a semantic token; their file/name/occurrence count stays constrained. Unknown semantic/font variable references or literal-name runtime CSS setters and parse errors always fail and cannot be baselined. Missing baseline data fails closed.

Allowed central definition files:

- `components/core/design-tokens.ts`
- `lib/styles/design-tokens.css`

Legacy definition files (existing definitions constrained by the baseline; new declarations are forbidden):

- `lib/styles/variables.css`

Legacy `variables.css` now consumes shared roles; its authored palettes, safe-area aliases and compatibility token definitions have been migrated. New design tokens belong in the TypeScript token source and its generated CSS. Private local variables use the `--_` prefix; they may compose semantic tokens for hover, selected and size states. Mantine `--mantine-*` overrides are upstream framework token assignments, not application token definitions. Runtime CSS setters may update registered semantic tokens or upstream/private variables; other literal names require an existing baseline allowance. The theme bridge may reference canonical tokens but cannot define another literal palette. The checker does not treat Mantine named palette props as literal colors because those are library token references.

`--write-baseline` is an explicit migration-maintenance operation. Review its diff; never run it as part of CI or to approve a new violation automatically. Existing debt is visible below. Removed debt is reported as stale and does not block migration; use `--prune-baseline --report` to remove only obsolete occurrences after review. Pruning cannot approve new findings.

## Remaining literal colors

| Source | Occurrences | Lines |
| ------ | ----------: | ----- |
| None   |           0 | —     |

## Remaining CSS spacing/typography literals

New nonzero px/rem/em values on padding, margin, gap, row-gap and column-gap fail (`raw-spacing`); zero, percentages, inherit, auto and token expressions are allowed, and spacing within explicit print media and page rules is classified as authored print geometry. Type sizes are stricter (`raw-font-size`): any literal unit (px, rem, em, pt, %, viewport units), font-size keywords and unitless line-height in `font-size`, `line-height` and `font` fail on screen and in print rules, because the token generator projects the paper scale onto the same roles. TS style objects, option objects, DOM style and canvas `font` assignments and `setProperty('font-size', …)` are checked the same way. Widths, heights, radii, viewport geometry and responsive breakpoints remain audit-only. Mantine named scale props in TS/TSX remain valid references. Initial spacing allowances were measured from git HEAD before this migration rather than approving the changed working tree.

| Source | Occurrences |
| ------ | ----------: |

Authored typography exceptions (artwork, not interface roles):

- `lib/utils/og-config.ts`: Generated share-image artwork defaults (pixel geometry rendered by Satori)
- `lib/utils/og-image.tsx`: Generated share-image artwork (pixel geometry from site settings)
- `features/page/blocks/immersive-scene/SceneRenderer.tsx`: Viewport-scaled immersive scene title artwork (clamp/vw geometry of the authored scene)
- `features/application-error/ErrorCodeParticles.tsx`: Canvas glyph mask sampled into the error-code particle artwork

## Most repeated literal CSS dimensions

| Literal    | Occurrences |
| ---------- | ----------: |
| `1px`      |          15 |
| `1rem`     |           9 |
| `0px`      |           8 |
| `120px`    |           8 |
| `3rem`     |           8 |
| `20rem`    |           7 |
| `2px`      |           7 |
| `3.5rem`   |           6 |
| `10rem`    |           5 |
| `15rem`    |           5 |
| `1.5rem`   |           4 |
| `1.75rem`  |           4 |
| `1em`      |           4 |
| `1.25rem`  |           3 |
| `12rem`    |           3 |
| `0.875rem` |           2 |
| `1.125rem` |           2 |
| `1.375rem` |           2 |
| `1.625rem` |           2 |
| `11.25rem` |           2 |
| `12.5rem`  |           2 |
| `132px`    |           2 |
| `18.75rem` |           2 |
| `180px`    |           2 |
| `2.25rem`  |           2 |

## Repeated custom-property names

| Name                                 | Declarations | Files                                                                                                  |
| ------------------------------------ | -----------: | ------------------------------------------------------------------------------------------------------ |
| `--_alert-ink`                       |            5 | `components/core/Alert/Alert.module.css`                                                               |
| `--_frame-navigation-width`          |            2 | `components/core/ApplicationFrame/ApplicationFrame.module.css`                                         |
| `--_badge-ink`                       |            5 | `components/core/Badge/Badge.module.css`                                                               |
| `--_collection-thumbnail`            |            5 | `components/core/Collection/Collection.module.css`                                                     |
| `--_collection-hero`                 |            5 | `components/core/Collection/Collection.module.css`                                                     |
| `--_action-ink`                      |            5 | `components/core/Control.module.css`                                                                   |
| `--_action-ink-muted`                |            5 | `components/core/Control.module.css`                                                                   |
| `--_action-fill`                     |            5 | `components/core/Control.module.css`                                                                   |
| `--_action-fill-hover`               |            5 | `components/core/Control.module.css`                                                                   |
| `--_action-fill-pressed`             |            5 | `components/core/Control.module.css`                                                                   |
| `--_action-boundary`                 |            5 | `components/core/Control.module.css`                                                                   |
| `--_control-height`                  |            7 | `components/core/Control.module.css`                                                                   |
| `--_disclosure-inline-inset`         |            4 | `components/core/Disclosure/Disclosure.module.css`                                                     |
| `--_disclosure-control-gap`          |            3 | `components/core/Disclosure/Disclosure.module.css`                                                     |
| `--_disclosure-title-padding`        |            2 | `components/core/Disclosure/Disclosure.module.css`                                                     |
| `--_disclosure-control-border`       |            2 | `components/core/Disclosure/Disclosure.module.css`                                                     |
| `--_disclosure-chevron-track`        |            2 | `components/core/Disclosure/Disclosure.module.css`                                                     |
| `--_disclosure-title-inset`          |            2 | `components/core/Disclosure/Disclosure.module.css`                                                     |
| `--_input-height`                    |            7 | `components/core/Input/Input.module.css`                                                               |
| `--_input-font`                      |            6 | `components/core/Input/Input.module.css`                                                               |
| `--_switch-travel`                   |            2 | `components/core/Input/Input.module.css`                                                               |
| `--_pin-length`                      |            3 | `components/core/Input/Input.module.css`                                                               |
| `--_surface-inset`                   |            7 | `components/core/MediaControls/MediaControls.module.css`, `components/core/Section/Surface.module.css` |
| `--_toast-ink`                       |            5 | `components/core/Notification/Notification.module.css`                                                 |
| `--_overlay-inset-top`               |            2 | `components/core/Overlay.module.css`                                                                   |
| `--_overlay-inset-right`             |            2 | `components/core/Overlay.module.css`                                                                   |
| `--_overlay-inset-bottom`            |            2 | `components/core/Overlay.module.css`                                                                   |
| `--_overlay-inset-left`              |            2 | `components/core/Overlay.module.css`                                                                   |
| `--_progress-ink`                    |            6 | `components/core/Progress/Progress.module.css`                                                         |
| `--_progress-track`                  |            2 | `components/core/Progress/Progress.module.css`                                                         |
| `--_surface-inline-border`           |            2 | `components/core/Section/Surface.module.css`                                                           |
| `--_selection-tile-min`              |            6 | `components/core/SelectionSurface/SelectionSurface.module.css`                                         |
| `--_selection-template`              |            6 | `components/core/SelectionSurface/SelectionSurface.module.css`                                         |
| `--_selection-icon-size`             |            3 | `components/core/SelectionSurface/SelectionSurface.module.css`                                         |
| `--_selection-status-inset`          |            3 | `components/core/SelectionSurface/SelectionSurface.module.css`                                         |
| `--_navigation-leading-track`        |            2 | `components/core/SideNavigation/SideNavigation.module.css`                                             |
| `--_social-brand-color`              |            2 | `components/core/Social/SocialIcon.module.css`                                                         |
| `--_table-of-contents-inset-end`     |            3 | `components/core/TableOfContents/TableOfContents.module.css`                                           |
| `--_tab-active-ink`                  |            5 | `components/core/Tabs/Tabs.module.css`                                                                 |
| `--_tab-active-fill`                 |            5 | `components/core/Tabs/Tabs.module.css`                                                                 |
| `--_text-hierarchy-inset`            |            2 | `components/core/TextButton/TextButton.module.css`                                                     |
| `--_document-settings-width`         |            2 | `features/authoring/DocumentEditorPanels.module.css`                                                   |
| `--_document-layout-controls-space`  |            2 | `features/document-layout/ui/ContentLayoutView.module.css`                                             |
| `--_map-callout-line-color`          |            2 | `features/map/ui/MapLibreMapView.css`                                                                  |
| `--_map-callout-current-text-color`  |            2 | `features/map/ui/MapLibreMapView.css`                                                                  |
| `--_map-callout-current-desc-color`  |            2 | `features/map/ui/MapLibreMapView.css`                                                                  |
| `--_map-callout-current-bg-color`    |            2 | `features/map/ui/MapLibreMapView.css`                                                                  |
| `--_map-callout-scale`               |            3 | `features/map/ui/MapLibreMapView.css`                                                                  |
| `--geul-font-size-xs`                |            2 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-font-size-sm`                |            2 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-font-size-md`                |            2 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-font-size-lg`                |            2 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-font-size-xl`                |            2 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-heading-title`               |            3 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-heading-h1`                  |            3 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-heading-h2`                  |            3 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-heading-h3`                  |            3 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-line-height-md`              |            2 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-line-height-document`        |            2 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-interaction-minimum`         |            2 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-chrome-scroll-offset`        |            2 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-background`                  |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-chart-series-primary`        |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-chart-series-secondary`      |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-chart-series-tertiary`       |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-surface`                     |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-surface-muted`               |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-surface-hover`               |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-surface-active`              |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-text-primary`                |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-text-secondary`              |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-text-muted`                  |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-text-hover`                  |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-border-default`              |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-border-strong`               |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-action-ink`                  |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-action-ink-muted`            |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-action-boundary`             |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-action-primary`              |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-text-on-action`              |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-action-primary-hover`        |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-action-primary-pressed`      |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-action-accent`               |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-action-accent-hover`         |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-action-accent-pressed`       |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-action-positive`             |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-action-positive-hover`       |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-action-positive-pressed`     |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-action-warning`              |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-action-warning-hover`        |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-action-warning-pressed`      |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-action-danger`               |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-action-danger-hover`         |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-action-danger-pressed`       |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-focus`                       |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-status-accent`               |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-status-positive`             |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-status-warning`              |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-status-danger`               |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-document-text-default`       |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-document-text-gray`          |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-document-text-brown`         |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-document-text-red`           |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-document-text-orange`        |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-document-text-yellow`        |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-document-text-green`         |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-document-text-blue`          |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-document-text-purple`        |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-document-text-pink`          |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-document-background-default` |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-document-background-gray`    |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-document-background-brown`   |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-document-background-red`     |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-document-background-orange`  |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-document-background-yellow`  |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-document-background-green`   |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-document-background-blue`    |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-document-background-purple`  |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-document-background-pink`    |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-wave-muted`                  |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-wave-cursor`                 |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--geul-embed-overlay`               |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--editor-text-color-default`        |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--editor-text-color-gray`           |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--editor-text-color-brown`          |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--editor-text-color-red`            |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--editor-text-color-orange`         |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--editor-text-color-yellow`         |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--editor-text-color-green`          |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--editor-text-color-blue`           |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--editor-text-color-purple`         |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--editor-text-color-pink`           |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--editor-background-color-default`  |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--editor-background-color-gray`     |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--editor-background-color-brown`    |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--editor-background-color-red`      |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--editor-background-color-orange`   |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--editor-background-color-yellow`   |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--editor-background-color-green`    |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--editor-background-color-blue`     |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--editor-background-color-purple`   |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--editor-background-color-pink`     |            5 | `lib/styles/design-tokens.css`                                                                         |
| `--font-family-sans`                 |            6 | `lib/styles/font-assignment.css`                                                                       |

## Authored-color exceptions

These sources contain provider identity colors or persisted/output artwork values. Their literal values remain separate from interface role tokens. Exceptions cover literal colors only; new custom-property declarations and unknown semantic references are still checked.

| Source                                                         | Reason                                  |
| -------------------------------------------------------------- | --------------------------------------- |
| `components/core/Social/brand-colors.ts`                       | Third-party identity palettes           |
| `lib/theme/site-brand.ts`                                      | Configurable site branding default      |
| `lib/types/map-theme/schema.ts`                                | User-authored map theme schema defaults |
| `lib/types/site-setting/config.ts`                             | User-authored site setting defaults     |
| `lib/utils/og-config.ts`                                       | Generated share-image palette           |
| `lib/utils/og-image.tsx`                                       | Generated share-image artwork           |
| `features/page/blocks/immersive-scene/schema.ts`               | User-authored scene defaults            |
| `features/page/blocks/immersive-scene/scene-renderer-model.ts` | User-authored 3D artwork                |
| `features/page/blocks/immersive-scene/settings-model.ts`       | User-authored 3D artwork defaults       |
| `features/map/hooks/useMap3DBuildings.ts`                      | Map artwork styling                     |
| `features/map/hooks/useMapLabels.ts`                           | Map artwork styling                     |

## Limits and interpretation

CSS uses a real PostCSS parser and TS/TSX uses the TypeScript compiler parser, so comments and regular expressions do not create false color findings. TS string values (including embedded HTML and templates) are inspected conservatively; persisted color defaults and graphic runtime strings outside explicit exception files may be baseline debt rather than interface styling. The audit does not infer intent from a matching color.

Generated/vendor sources, documentation, Storybook output, story fixtures, stories, tests, type declarations and fixtures are excluded. CSS selector/data-attribute custom-property references not expressed as semantic/font `var()` references, computed concatenated token names, dynamic numeric JS style values, user-uploaded styles and third-party runtime CSS are not validated. Literal CSS dimensions are counted only on the properties listed by the scanner. CSS spacing enforcement covers the explicit properties above; JavaScript numeric spacing props, private variable values and dynamically composed styles are not covered. Repeated declarations usually mean light/dark or state overrides; review their role and cascade before consolidating them.
