# Editor color theme contract

The text editor's named color palette consumes Geul semantic roles. Its swatches,
current text/background preview, inline marks, block colors, table cells and published
documents use the same roles in every preset. The shared theme provider projects the
base scheme through `data-geul-theme` and the selected preset through
`data-geul-theme-id`, including system mode before hydration.

## Palette authority

`components/core/design-tokens.ts` owns the primitive color families and
`semanticThemes` owns the `document-text-{name}` / `document-background-{name}` roles.
`theme.ts` exposes the base roles through `theme.light` and `theme.dark`;
`themeVariables(ThemeId)` projects the selected registry preset. Ocean Light and Ocean
Dark retain their corresponding base document palette and reuse its durable names.
The generated stylesheet keeps `--editor-text-color-{name}` and
`--editor-background-color-{name}` as compatibility aliases to these roles; editor
consumers must not supply an independent palette.

The primitive palette contains neutral/graphite, brown, red, orange, yellow, green, blue,
purple and pink families. Its 50–900 scale has monotonically decreasing luminance and
restrained chroma: brown is a warm earth tone, purple a muted violet hue, and pink a
muted rose hue. Authored color choices do not add command or status meanings.

| Durable name                                  | Light text  | Dark text    | Light background | Dark background          |
| --------------------------------------------- | ----------- | ------------ | ---------------- | ------------------------ |
| default                                       | neutral 900 | graphite 50  | transparent      | transparent              |
| gray                                          | neutral 700 | graphite 200 | neutral 200      | graphite 700             |
| brown, red, orange, green, blue, purple, pink | family 700  | family 300   | family 50        | family 900               |
| yellow                                        | yellow 800  | yellow 300   | yellow 50        | 75% yellow 900 + 25% ink |

The amber mixture belongs only to the dark document background role. Yellow 900 by
itself is too bright for the independently selectable brown, purple and pink text
colors. Core resolves the existing primitive mixture to hex for CSS and non-CSS
consumers; warning/status/action colors retain their existing roles.

All 100 named text/background combinations in each base palette meet 4.5:1 text contrast. The
current minimum is 5.71:1 in Light (gray on gray) and 4.69:1 in Dark (purple on yellow).
Text on the document surface and default text on every named background are also
checked. These guarantees concern the supplied named palette; arbitrary authored hex
values retain their author's selection.

## Persistence and consumers

Documents persist durable names such as `purple` and `yellow`, never the resolved
theme hex. Switching theme changes their appearance without rewriting marks, block
props, selected colors or stored content. Existing documents containing named colors
automatically use the new default palette. Safe legacy hex values remain exact authored
values; unknown strings cannot inject inline CSS. No document migration is required.

Core `DocumentColorPreview` owns text, background and current-pair samples through
the compatibility aliases. Text samples show colored `Aa` with a matching underline;
background samples show default text on the actual background, with a checkerboard
for transparency. Core `DropdownMenu.Item.colorPreview` owns the sample track and
shared row density. `EditorColorStyleButton` exposes separate text and background dropdowns;
`TiptapBlockMenu` consumes the same sample contract in its submenu.
`lib/styles/document-content.css` projects the same aliases
onto inline and block attributes. `TiptapTable.module.css` supplies table cell colors.
The shared provider and shell theme toggle change all of these consumers together.
There is no separate editable product palette or second color-scheme setting.

## Verification

`Feature/Editor/Color Palette/Authored / DurableColors` shows every named text and
background swatch, actual document-rendered samples and the current chosen pair.
Its play assertions compare rendered colors with the selected theme.
Switch the toolbar among Light, Dark, Ocean Light and Ocean Dark after choosing a color: the selected names and
menu checkmarks persist while swatches and document text/backgrounds update.

Regression tests cover complete base roles and aliases in the runtime adapter
and generated CSS, reuse of existing color families, new-family grade luminance,
all text/background contrast combinations, mounted color selection during theme
changes, actual Tiptap mark roundtrips and safe legacy colors.

`Feature/Editor/Tiptap/Public Block Comparison/Document Colors` uses the production
TiptapEditor, canonical protobuf/Yjs room, materialized localized snapshot and
GeneratedRichTextBlockView. It compares all ten named colors on actual paragraphs,
inline marks and table cells against the active theme and exercises separate text
and background bubble commands. Changes in the editor flow into the published
renderer through the same room observation used by the comparison. This proves
local rendering and mutation parity, not server delivery or persistence.
