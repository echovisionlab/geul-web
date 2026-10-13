# Tables and collection toolbars

Core owns cell spacing, header/body alignment, control density, responsive switching and divider geometry. Features supply columns, records, localized labels and actions. Use existing space, type, control and border tokens; this consolidation introduces no new tokens.

## Shared toolbar ownership

[ToolbarLayout](../../components/core/Section/ToolbarLayout.tsx) owns collection search/filter/action geometry for file browsers and data tables. `SelectionToolbar`, `DataTableToolbar` and `DataTableSelectionToolbar` are adapters to this same owner; none keeps its own responsive CSS. The client and server DataTable families consume these adapters.

| Contract                       | Use                                                                   |
| ------------------------------ | --------------------------------------------------------------------- |
| `arrangement="flow"`           | Existing child-based toolbar compositions; wrapping flex layout       |
| `arrangement="actions-end"`    | Search, filter/sort group and actions; optional leading location      |
| `arrangement="actions-inline"` | Location + view actions, then search/filter controls as width permits |
| `density="compact"` (default)  | Shared compact button scale and xs search/filter text                 |
| `inset="none\|content"`        | Plain table controls or content-aligned file browser inset            |
| `divider="none\|surface"`      | Exactly one explicitly owned boundary                                 |

Only Core owns container queries. Below `lg`, an inline collection toolbar places location/actions first and filters/search second. Below `sm`, location and view actions remain together; search and filters occupy their own rows. Ordinary table controls keep search/filter/actions on one row down to `xs`; below `xs`, search takes the first row and filter/actions share the second row, avoiding an isolated trailing action row. Slots have zero intrinsic minimum so long translations and inputs cannot widen the parent. Action groups use xxs spacing and wrap where appropriate. Search fields fill their allocated slot; client/server table searches have no feature-owned 400px width wrapper.

TextInput, Select, MultiSelect and NativeSelect inherit compact size/density from the toolbar provider; Select/MultiSelect portals retain that same scale. Standalone fields retain their existing named sizes. Core controls retain the interaction-minimum behavior for coarse pointers. Do not shrink targets through feature CSS or numeric icon sizes.

ToolbarLayout keeps ordinary Tab order and the native input/combobox arrow keys. Contextual editor commands continue to use `ToolbarSurface`, which owns command-arrow navigation. These are distinct interaction contracts: a search/filter form must not acquire command-navigation behavior merely because it looks like a toolbar. See the [WAI toolbar pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/).

## Tables

`DataTableView` defaults to compact density. Header and body checkbox cells use the same selection-control wrapper, middle alignment and reserved track. Consumer overrides for checkbox vertical alignment are removed. Single-selection and non-selectable rows omit controls while reserving the same leading track when the table supports selection.

Use `columnSizing="fixed"` where a flexible name/title track must truncate. Long text retains its full accessible value and title. Align numeric/size columns with `column.align="end"`, including their header. Header sort labels and indicators stay together and respect the column alignment; they do not occupy opposite ends of a wide name track. Do not hide columns with consumer CSS.

| Narrow presentation                      | Use                                                                                                             |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `mobileLayout="inline"`                  | One-line collections; flexible name, short trailing metadata, `mobileVisibility="hidden"` for secondary columns |
| `mobileLayout="compact"`                 | A primary line with concise secondary metadata where both are needed                                            |
| `mobileLayout="cards"`                   | Records whose named fields must remain available in a readable stack                                            |
| Native `Table` + `Table.ScrollContainer` | True comparisons/matrices where column relationships must be retained                                           |

File Manager and Editor File Library Picker share [FileBrowserListView](../../features/file-manager/ui/FileBrowserListView.tsx), plus one presentation adapter. File rows are always inline: checkbox, icon, filename, short lowercase extension and size. Below the container `sm` breakpoint, format/location are omitted and only size remains. Full MIME and richer administrative metadata remain in details. See [file-browser.md](./file-browser.md).

Use `rowDividers="between"` when a footer owns the final boundary. Do not combine a last-row rule with another footer rule or add an outer border/striping to an already separated compact table without a specific need. A standalone table owns its final rule.

Scroll containers need a localized region name and a keyboard focus target. Native tables retain `th`, `td`, scope and sorting state; responsive styling does not replace those relationships. See the [WAI table guidance](https://www.w3.org/WAI/tutorials/tables/).

## Consumer review and corrections

| Family inspected                                                      | Result                                                                                                                                                     |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client/server DataTable                                               | Shared toolbar layout and control density; redundant top checkbox alignment removed; search width wrappers removed                                         |
| File Manager / Library Picker                                         | One shared list, trailing short format/size, inline mobile rows, current-folder-only narrow path, matching header/list insets and no duplicate status rule |
| Translation overview matrices                                         | Existing large-density/striping/outer-border combination replaced by compact rows and one row rule; shared labelled keyboard-scroll container              |
| Policy history                                                        | Shared labelled keyboard-scroll container protects date-range columns on narrow screens                                                                    |
| Form submissions, translation jobs, campaign analytics, public series | Already use Core Table scroll containers; retained existing domain-specific columns                                                                        |
| Release track credits and release associations                        | Existing responsive card/table or compact Core Table consumers; retained needed domain fields and reorder behavior                                         |

This is an ownership and source review of those families, not a claim that every application route has received visual approval. Verify representative Core stories and production-view stories at phone/tablet/desktop widths, in light/dark and more than one locale. Core typography/control/layout checks, runtime/type contracts and interaction tests accompany visual checks.

## Storybook and verification

Use Core / Layout / ToolbarLayout / Collection and Table Controls for slot reflow and inherited control scale. Composition / Data Table / Toolbars shows the compatibility adapters. Core / Data Display / DataTableView / Inline List shows truncation and secondary-field omission; existing cards/compact/sorting/loading stories cover the other contracts. File picker form stories verify actual selection, Add and Submit; the browser story contains no extra form.

Test that resizing does not change records or selection, checkbox/range input remains modifier-aware, search/combobox keys remain native, folder navigation respects the accessible root, and horizontal scrolling stays within the table region. Regenerate inventories after adding or moving system components.
