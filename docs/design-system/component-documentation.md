# Component documentation contract

Each Storybook `Core/<category>/<component>` document covers the actual component's purpose, anatomy, public API, states, accessibility and consumers. Search `Design System/Components` to open Core documentation and state examples.

Tokens, themes and Core own the adopted rules. Documentation examples and dimensions from external systems do not change these contracts automatically.

## Documentation content

Place a representative live example after the summary. Choose the CSF `Default` export when present; otherwise identify the actual first example. Expand the example to run the same Core component and Controls. Open other states through individual Canvas links.

An opened example stays open when the header language or theme changes. Explicit closing and
each component document's expansion state are independent. This state belongs to the review
session and does not change saved application preferences.

Controls change args exposed by the actual story. Connect static enum/boolean types and explicit defaults while preserving fixture options and `control: false`. Do not guess choices from unresolved aliases or conditional types. The code panel shows the example's original CSF; application usage examples belong in [Getting started](./getting-started.md).

| Section                | Editorial or extraction requirement                                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Purpose and selection  | Task served and distinction from similar components                                                                           |
| Anatomy                | Root, label, slots, control order and responsibility of each layer                                                            |
| Public API             | Source props, permitted types, required status and explicit defaults                                                          |
| State examples         | Story IDs and display names actually exported by current CSF                                                                  |
| Usage guidance         | Semantic contracts, composition, data, content, placement and asynchronous work                                               |
| Accessibility          | Names, roles, values, states, relationships, keyboard, focus and error recovery                                               |
| Constraints            | Unsupported overrides, union combinations, unresolved inherited types and verification limits                                 |
| Consumers              | Core, Feature and App files identified through actual imports and barrel exports                                              |
| Related specifications | Repository-owned contracts and API reviews                                                                                    |
| Token references       | Static variables in owned TS files and direct/local CSS imports, with reference locations, central definitions and conditions |

[Usage Rules](./getting-started.md#documentation-structure) compares correct and incorrect compositions using actual Core components. Follow the [contribution process](./contribution.md) and update the affected regression tests.

The adopted documentation model follows Storybook's [documentation guide](https://storybook.js.org/blog/how-to-document-your-design-system-best-practices-tools/), [structure guide](https://storybook.js.org/blog/structuring-your-storybook/) and [Docs approaches](https://storybook.js.org/blog/4-ways-to-document-your-design-system-with-storybook/): usage guidance, live examples and API references stay connected to implementation.

Document the following family-specific contracts:

- Button, IconButton and TextButton: action/link branches, names and state semantics.
- Inputs: value, label, description, error, required, disabled and readOnly. Field: child associations and semantic relationships.
- Choices: boolean, single-selection and multiple-selection models, with group names.
- Tabs, menus and dialogs: actual keyboard models, focus entry and return.
- Tables: actual data, column headers, sorting, selection, row actions, pagination and two-dimensional content at narrow widths.

## Reading the public API table

`required=true` means **required in every union branch**. A `false` value does not always mean optional. IconButton's `label`, `aria-label` and `aria-labelledby` are not individually required across all branches, but one naming branch is mandatory. A link's `href` is required in that branch. Read the complete Button/TextButton/IconButton types for valid action/link and drag-handle geometry combinations.

`never` identifies an unsupported property. Documentation must not reopen a closed styling API.

Explicit defaults come only from initializers in implementation parameters using the exact props contract. Story args and arbitrary internal fallbacks are not defaults. Guidance separately describes values affected by parent action-row, toolbar, density or contrast context. A blank default does not guarantee `undefined`.

External React/React Aria inherited types and unsupported mapped/conditional types remain listed as limitations. Do not assume that unlisted inherited properties are permitted: the public type and runtime projection define the boundary. Preserve original generic names such as `Row` and `T` rather than replacing consumer-supplied types with strings. Composed fixture props are not product Core APIs.

## Source ownership and updates

- Generator: `scripts/design-system/storybook-component-docs.mjs`
- Editorial purpose, anatomy and guidance: `stories/design-system/components/component-guidance.mjs`
- Generated registry: `stories/design-system/components/component-docs.generated.json`
- Catalog: `stories/design-system/components/Components.stories.tsx`
- API and behavior authority: `components/core/**`

Generation reads TypeScript ASTs, local imports/barrel exports and current CSF metadata without executing Core or stories. It fails for missing/stale guidance, missing/duplicate/stale registry groups, state IDs inconsistent with current exports and missing source/document references.

`tokenReferences` preserves reference locations, central CSS definitions and theme/media conditions. `styleSources` records the CSS files read and their importers. `computedTokenReferences` and `tokenReferenceLimitations` record computed names and unresolved scope. The extractor does not infer ordinary TS-import, nested-component or complete barrel style graphs, or runtime activation. An empty list means no static reference was found within this scope; it does not establish that the component is token-free.

```sh
node scripts/design-system/storybook-component-docs.mjs
node scripts/design-system/storybook-component-docs.mjs --check
node --test scripts/design-system/storybook-component-docs.test.mjs
```

Regenerate when Core APIs, defaults, states or consumers change. Update editorial guidance when usage, anatomy or accessibility meaning changes. `--check` rejects hand-edited generated output.

## Review sequence

1. Check purpose and actual consumers; compare the selection criteria with similar Core components.
2. Check API, anatomy, tokens/themes, unsupported overrides and valid state combinations.
3. Open state stories individually and exercise interactions, asynchronous work, errors, recovery, keyboard and focus.
4. Review consumers on mobile, tablet and desktop, in light/dark and custom themes, supported locales and long/empty content.
5. Record the scope and outstanding work for automated checks, keyboard tests and actual assistive-technology verification separately.

A story's existence does not establish that its state passed review. Successful generation demonstrates source/document connections; it does not establish product-page, VoiceOver, Orca or usability verification.
