# Geul design system writing criteria based on Carbon

Updated: 2026-10-12. This is a writing and review policy, not a report that every criterion has passed.

Use Carbon's approach to specifications. Current Geul tokens, theme and Core own color, typography, geometry and interaction.
Keep documentation and actual running examples together in Storybook, and review changes in actual consumers.

## 1. References and application scope

| Subject                  | Official Carbon reference                                                                                                                                                                    | Geul policy                                                                                                                             |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Tokens and themes        | Names and meaning remain stable while theme values change. [Themes](https://www.carbondesignsystem.com/building-blocks/foundations/themes/overview)                                          | The same Core consumes the same semantic roles in Light/Dark.                                                                           |
| Role boundaries          | Shared roles are distinct from component roles. [Color overview](https://www.carbondesignsystem.com/building-blocks/foundations/color/overview)                                              | Distinguish primitive, semantic, invariant and derived roles. Equal values do not imply equal meaning.                                  |
| Typography               | Size, weight and line height form roles. [Typography](https://www.carbondesignsystem.com/building-blocks/foundations/typography/overview)                                                    | Document body, heading, command, supporting text and locale-specific fonts.                                                             |
| Spacing                  | Internal and external spacing have separate owners. [Spacing](https://www.carbondesignsystem.com/building-blocks/foundations/spacing/overview)                                               | Core owns internal padding/gap; compositions consume Core Layout for external spacing.                                                  |
| Responsive layout        | Screen structure and breakpoint-specific design. [2x Grid](https://www.carbondesignsystem.com/building-blocks/foundations/2x-grid/overview)                                                  | Review mobile, tablet, desktop and Geul breakpoint boundaries.                                                                          |
| Component specifications | Anatomy, geometry, states, content and overflow accompany code and documentation. [Component checklist](https://www.carbondesignsystem.com/getting-started/contributing/component-checklist) | Connect public API, tokens, running examples, consumers and verification scope.                                                         |
| Content                  | Terminology and input/error/context guidance. [Content](https://www.carbondesignsystem.com/building-blocks/foundations/content)                                                              | State conditions, actions and results precisely. Exclude unmeasurable praise from specifications.                                       |
| Accessibility            | Names, descriptions, errors, keyboard and automatic/manual checks. [Text input accessibility](https://www.carbondesignsystem.com/building-blocks/core/components/text-input/accessibility)   | Review actual DOM semantics, keyboard, focus, contrast and recovery. Record automatic and actual assistive technology scope separately. |

Do not adopt IBM Blue, IBM Plex, Carbon's primary button default, padding or grid values as Geul defaults.
Distinguish [Carbon Button](https://carbondesignsystem.com/components/button/usage/) from Geul's neutral/medium and neutral/low contracts.
This policy does not require installing Carbon or replacing components.

## 2. Owners and Storybook representation

| Decision                                             | Source owner/document                                     | Storybook evidence                                                      |
| ---------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------- |
| Palette, spacing, size, boundary, opacity and motion | `@echovisionlab/design-system/tokens` → `primitiveTokens` | Roles, units, values and actual consumption examples                    |
| Light/Dark semantic colors                           | Same module → `semanticThemes`                            | Theme values under the same roles and rendering of the same Core        |
| Image overlays, canvases and print                   | Same module → `invariantTokens`                           | Theme-independent meaning and use context                               |
| Derived roles                                        | `derivedTokenRoles`; [token contract](token-contract.md)  | Source aliases and consumers; do not flatten aliases into copied values |
| Locale and fonts                                     | `lib/styles/font-assignment.css`                          | Actual locale fonts, direction and long translations                    |
| Runtime and preview theme                            | `theme.ts`, `.storybook/preview.tsx`                      | Shared app provider and CSS baseline                                    |
| Anatomy, states and closed API                       | `components/core/**`; [ownership](ownership-contract.md)  | Purpose, anatomy, props, supported states and accepted/rejected usage   |
| Layout and responsive composition                    | Core Layout; [density contract](size-density-contract.md) | Parent width, gap, wrapping, overflow and state preservation            |
| Input semantics and validation                       | Core Input; [input contract](input-contract.md)           | Label/value/description/error/actions relationships and actual input    |
| Consumers and previews                               | [Generated inventory](generated-inventory.md)             | Source owner, story, route/View mapping and inclusion boundaries        |

Follow [AGENTS.md](../../AGENTS.md) and the [design system](../design-system.md).
Do not bypass Core through Feature CSS or arbitrary presentation props.

## 3. Writing order and deliverables

| Order | Subject               | Deliverable                                                                                                          |
| ----- | --------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1     | Foundations           | Token intent, values, aliases, themes, typography, spacing, icons, motion and responsive rules with examples         |
| 2     | Core components       | Purpose, anatomy, closed API, geometry, states, content, accessibility, consumers and running examples               |
| 3     | Repeated compositions | Parent layout and behavior of Field, ActionRow, Toolbar, Section, Navigation and Dialog                              |
| 4     | Pages                 | Actual Views, fixture data, tasks, failure/recovery, route and service boundaries                                    |
| 5     | Verification          | Accepted/rejected types, behavior regressions, story play, browser measurements, manual results and unresolved items |

Readers must be able to read Docs and exercise the relevant implementation in Canvas.
Do not substitute whole-screen images or imitation components with different source for actual examples.
Document provider, hook and controller responsibilities through code contracts and consuming compositions.

## 4. Component specification format

| Field                     | Required content                                                                              |
| ------------------------- | --------------------------------------------------------------------------------------------- |
| Purpose                   | Function, use conditions and selection between similar parts                                  |
| Anatomy                   | Order and owners of root, label, icon, value, description, error and actions                  |
| API                       | Public props, allowed values, defaults, required relationships and source owner               |
| Geometry                  | Owned tokens for height, target, padding, gap, boundary, text and icon                        |
| States                    | Actual default/hover/focus/pressed/selected/disabled/pending/readOnly/invalid support         |
| Combinations              | Visual precedence of valid states such as focus+invalid, unsupported combinations and reasons |
| Content                   | Short/long/empty values, multiline content, icons, locale, RTL, overflow, wrap and ellipsis   |
| Layout                    | Content/full/fixed width, min/max, parent resizing and breakpoint changes                     |
| Interaction/accessibility | Names, descriptions, relationships, state, keyboard, focus and error recovery                 |
| Usage                     | Actual consumers, accepted usage, rejected bypasses and related running stories               |
| Verification              | Executed environment, evidence, unresolved items, owner and change date                       |

Use the shared [component documentation](component-documentation.md) and [page documentation](page-documentation.md) formats.
Write a specification as `condition → behavior → verification`. For example: a coarse pointer requires a minimum
44px command height occupying actual layout space; check that adjacent targets do not overlap.

Define valid APIs and important combinations before adding a Cartesian specimen matrix.
Supported contract, example list and executed checks are separate information. Example counts are not complete verification.

## 5. Mobile, tablet and desktop review

Representative CSS viewports are 390×844, 834×1112 and 1440×900px.
Geul xs/sm/md/lg/xl breakpoints are 576/768/992/1200/1408px.
Form/compact/standard/wide maximum content widths are 448/768/992/1200px and serve a different purpose from transition boundaries.
Values assume the default 16px root.

| Environment | Required review                                                                                           |
| ----------- | --------------------------------------------------------------------------------------------------------- |
| Mobile      | Single flow, navigation changes, command labels, keyboard, safe-area, dialogs/scroll and long input       |
| Tablet      | Split/merge boundaries, portrait/landscape and simultaneous touch/pointer use                             |
| Desktop     | Maximum content width, columns, toolbar/table density, keyboard movement and hierarchy                    |
| Shared      | Focus, selection, errors, readOnly, pending, Light/Dark, long translations, RTL, text zoom and low height |

Also inspect 320px and just below/at/above relevant breakpoints. Record actual iframe viewport, wrapper and product surface widths.
A viewport name does not establish touch/coarse verification. Review whether resizing loses input, selection or focus,
and whether toolbar wrapping/scrolling, fields and dialogs keep primary commands accessible.

Fine-pointer general controls use 30/36/42/50/60px, compact 28px and chrome 32px.
Coarse-pointer minimum is 44px; text inputs use at least 16px text.
Small glyphs and large targets are [separate roles](spacing-icon-contract.md).

## 6. Completion criteria and review

Using Carbon's [completion checklist](https://www.carbondesignsystem.com/getting-started/contributing/component-checklist) as a reference,
record completion only for the supported scope with all relevant evidence below.

- Token roles, values, units, aliases and themes correspond to actual Core consumption.
- Documented API, defaults, states and anatomy match current source and running examples.
- Review the same Core in Light/Dark, long content, locales, parent widths and supported states in the browser.
- Review names, relationships, keyboard, focus and recovery through actual interaction; separate automatic and assistive technology results.
- Implement changes in token/Core owners and check consumers, accepted/rejected types and relevant regressions.
- Document page-fixture data, authorization, service and shell boundaries; retain actual-route checks where required.
- Evidence identifies source/build, story ID, args, viewport, pointer, theme, locale, observations and unresolved scope.

Review tables use `item / status / evidence / unresolved / next owner`.
Statuses are `not written`, `in review`, `adopted` and `deferred`.
Judge tokens, types, behavior, visuals, accessibility and consumers separately.
Automatic counts and documentation/preview presence do not establish complete design approval.
