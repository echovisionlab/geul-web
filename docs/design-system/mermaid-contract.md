# Mermaid theme adapter

The shared Mermaid renderer consumes Core roles through
`features/mermaid/mermaid-appearance.ts`. It always initializes Mermaid's `base`
theme, including callers without a DOM appearance. No Mermaid consumer chooses a
separate library theme or adds a local palette.

The adapter resolves concrete computed colors because an SVG image cannot inherit
the page's CSS variables. Unresolved or unsupported CSS colors fall back to the
same light/dark assignments in `components/core/design-tokens.ts`. The mounted
diagram reads the computed interface font and size, and renders again when the
selected `ThemeId` or locale changes. Light to Ocean Light and Dark to Ocean Dark
also replace the SVG, even though the base scheme stays the same. Its abort signal prevents a stale render from
replacing the image from the newly selected theme.

| Diagram role                                                                                   | Core authority                                                                        |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Background, nodes, notes, alternating rows, composite states, pie slices and category surfaces | `background`, `surface`, `surface-muted`                                              |
| Text, secondary axes, links, arrows and boundaries                                             | `text-primary`, `text-secondary`, `text-muted`, `border-default`, `border-strong`     |
| Chart series                                                                                   | `chart-series-primary`, `chart-series-secondary`, `chart-series-tertiary`             |
| Git branches and their filled labels                                                           | `chart-series-primary`, `chart-series-secondary`, `text-on-action`                    |
| Gantt active, completed and critical tasks                                                     | `status-accent`, `status-positive`, `status-danger` boundaries, with neutral surfaces |
| Gantt today marker and errors                                                                  | `status-danger`                                                                       |

Flowchart, sequence, class, ER, state, requirement, Gantt, pie, Git, timeline,
journey, quadrant, XY, radar, Cynefin, Wardley and event-modeling theme variables are assigned in this one adapter.
Explicit category variables prevent Mermaid from deriving unrelated hues from a
neutral base color. Category distinction uses the existing neutral chart roles;
it does not imply success, warning or danger. Pie uses neutral surfaces with
primary text. Git uses the two chart inks that support small inverse labels;
the tertiary chart ink remains available for line/bar series. Repeated categories continue to use
their authored labels and the library's geometry.

User-authored `classDef`, `style`, node styles and diagram geometry remain document
content. The renderer passes that source unchanged. Site-owned `theme`,
`themeVariables` and `themeCSS` configuration remains locked, together with the
existing security limits. This boundary applies to the standalone editor, Tiptap
node view, page block, page canvas, generated rich text and published page because
all of them consume `MermaidDiagram`.

## Accessible diagram representation

A successfully rendered diagram exposes one named image on a `div[role="img"]`. A visible
caption supplies that name through `aria-labelledby`; without a caption, the
authored accessible title supplies the name, falling back to the existing Mermaid
label. The inner SVG image keeps its pixels and intrinsic width and has an empty
alt because the enclosing image owns the complete accessible representation. The
caption is visible and does not create a second named image.

The renderer reads Mermaid's generated `accTitle` / `accDescr` title and description
metadata from the SVG document. Authored title text that differs from the visible
caption and the authored description are exposed through the image container's accessible
description. Caption-equivalent text is not repeated. No node relationships or
alternative explanation are invented. Authors must still provide an adequate
description for a complex diagram; a generic name does not convey its relationships.
The same `div` uses `role="figure"` while loading or showing an error, keeping its
status and alert descendants exposed before an image exists. Its visible caption
is a span associated by ID. A native `figure` containing `figcaption` cannot be overridden with `role="img"`;
the native host contract is checked against axe's `aria-allowed-role` rule.

This follows [Mermaid's accessibility metadata](https://mermaid.js.org/config/accessibility)
and the [WAI-ARIA named image role](https://www.w3.org/TR/wai-aria-1.2/#img), with
the [ARIA in HTML host restrictions](https://www.w3.org/TR/html-aria/#el-figure).
`Feature / Mermaid / Diagram / Accessible Description` exercises the actual renderer,
visible caption, single image name and authored description. The public/editor
comparison waits for a ready named image container and its successfully loaded SVG image before
running accessibility checks. Screen reader acceptance remains a separate review.

Storybook `Feature/Mermaid/Diagram` includes `ReadOnly`, `Sequence`,
`EntityRelationship`, `State`, `Schedule`, `Pie`, `Chart`, `Timeline` and
`AuthoredStyle`, alongside the real editor, Tiptap and page adapters. Switch the
global theme on a mounted diagram to inspect replacement of the generated SVG.
`AuthoredStyle` preserves its explicit content color in every preset while the
un-styled node and connecting line follow the site roles.

Regression coverage includes concrete-color fallback, real Mermaid base-theme
derivation, serialized renderer configuration, rendered image replacement after
a base or custom preset change, and rejection of a late render from the previous theme.
