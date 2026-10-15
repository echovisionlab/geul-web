# Design ownership contract

Core owns shared appearance, geometry and interaction state. Features compose its closed APIs and
own domain behavior. Types, runtime projection and source ownership checks enforce this boundary;
actual consumer previews verify the resulting composition.

## Ownership

| Definition                                  | Owner                                  | Consumer responsibility                                                                   |
| ------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------- |
| Theme roles, geometry scales, type, motion  | `design-tokens.ts`                     | Choose an existing semantic role; do not define another public visual authority           |
| Framework role mapping and default state    | `theme.ts` and shared runtime adapters | Consume the same theme and color-scheme contract                                          |
| Control appearance, size, density and state | Core component contract                | Supply semantic props, label, data and events                                             |
| Composition and domain behavior             | Feature/Screen                         | Arrange system parts; retain querying, commands and authorization                         |
| Third-party product controls                | Shared editor/map/media adapter        | Translate typed system roles into dependency options                                      |
| User-authored content and runtime geometry  | Domain/document renderer               | Preserve authored values and geometry; do not use the exception to restyle product chrome |

## Typed API boundary

Public Core types project the supported contract without inheriting vendor presentation props. `tone`, `emphasis`, `shape`, `size`, density, text typography and toggle state need named,
closed types. Derive supported sizes and token names from their existing authority. Keep accessibility,
form behavior, domain data and event props available.

`styles`, `vars`, `unstyled`, raw color/variant/radius, arbitrary numeric control sizes and arbitrary
font/border/background overrides must not remain general consumer APIs. If a real consumer requires
them, first determine whether an existing variant suffices or a shared variant is missing. Layout
constraints need a separate contract restricted to layout properties; preserving a general
`React.CSSProperties` style prop leaves the presentation boundary open.

Class names and stylesheet selectors also need enforcement. Closing TypeScript props alone cannot
prevent a Feature stylesheet from setting a shared button's hover color, dimensions or private CSS
variables. A layout class must not become an alternate presentation API. Dependency adapters with
genuine external-style obligations need explicit ownership records, not unrestricted exceptions.

## Minimum negative checks

| Case                                                                       | Required rejection or proof                                                           |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `<Button styles={{ root: { background: ... } }}>`                          | Type error; consumer cannot replace presentation                                      |
| Raw Mantine control where Core already covers it                           | Import/ownership error, including aliases and namespace imports                       |
| Arbitrary numeric size for a Core control                                  | Type error; supported named size or a reviewed shared variant                         |
| Feature CSS setting `--button-height`, `--ai-bg`, shared hover/focus rules | CSS ownership error; fix the shared owner first                                       |
| Invalid token name or redefining a registered public role                  | Type/lint error outside the authority                                                 |
| Numeric visual props or CSS state literals outside their owner             | Ownership review or documented layout/content exception                               |
| Existing token used in an incompatible role                                | Role-specific component/adapter contract; token-name existence is insufficient        |
| Styled control hidden behind a spread/helper/callback                      | Type boundary plus resolved AST/stylesheet checks; source regex alone is insufficient |

Negative cases must be exercised alongside valid layout and specialist cases. Do not create a blanket
allowance for all inline styles, all numeric geometry, a whole editor file or every `--_` variable.
Shared adapter exceptions must name their owner and exact purpose.

## Shared state and preview proof

The shared owner defines default, hover, keyboard focus, pressed/selected, error, disabled and loading
priority. Turning off motion must preserve a static focus indication. Toggle selection must remain
visible when accent and neutral resolve to the same neutral palette. Media controls over an image
consume invariant overlay roles rather than the document action fill. These are existing-role or
shared-variant issues before they are new-token issues.

Storybook must render the actual owner and consumer composition under the same locale/theme stack.
Provide interaction cases for the changed contract, including conflicting states such as selected
plus keyboard focus, error plus focus, and pending plus dismissal. Document which production
consumers migrated; a component-only preview does not prove every page uses it.

## Completion evidence

Every design change reports the changed system definition, actual consumers, rejected escape cases,
runtime/story verification and remaining limitations. A passing token freshness/literal check alone
is insufficient.

## Shared geometry and composition

Common sizes, toolbar/action-row context, coarse-pointer minimum targets and breakpoint projections
are owned centrally. Shared CompactTiptapEditor frames and ParticipantRow consume these owners.
Responsive ownership checks reject numeric common thresholds and Feature overrides of private
control geometry; exact authored geometry exceptions stay narrow. See the
[size and density contract](size-density-contract.md).

## Layout

[Core Layout](../../components/core/Layout/index.ts) exposes closed composition APIs.

- Nine actual component exports: LayoutStack, LayoutInline, LayoutInset, LayoutSpacer, LayoutContainer,
  LayoutGrid, LayoutGridItem, LayoutVisibility and LayoutBleed. Space derives from the existing six primitive spacing keys plus
  structural `none`.
- Responsive values use the five breakpoint names registered in design-tokens.ts and
  consumed by theme/PostCSS through generated design-breakpoints.json. Private Layout variables are
  assigned only by the owner, using an exhaustive static map of registered geul-spacing references.
- Public outer props select id/title/role/lang/dir/hidden/tabIndex, known native event handlers, aria
  and primitive-valued data fields. No public style/className/classNames/vars/unstyled/Box typography
  or custom component renderer exists. `as` is limited to structural HTML tags. The runtime projects
  the same allowed fields; cast/JS spreads cannot pass a visual override through to the element.
- All `data-geul-*` values are reserved and removed from consumer runtime props. Known internal Layout
  markers are explicit forbidden type keys; an index constraint also rejects identified reserved
  object assignments. TypeScript may ignore unknown dash-prefixed JSX attributes, so rejection of
  the entire reserved namespace additionally depends on the ownership lint/CI gate and runtime
  projection. Public component names alone do not bypass this limitation.
- Layout roots own min-width:0 and hidden display precedence. Inline controls named align/justify/wrap;
  Inset separates block/inline padding; Spacer is aria-hidden; Container consumes distinct named
  content-width roles. Grid supports structural column counts from 1 through 12. GridItem validates
  span plus offset against its real parent's resolved column count at every breakpoint, including
  full-span and orphan rejection.

Verification sources are [the dedicated negative type fixture](../../components/core/Layout/Layout.type-test.tsx),
[behavior tests](../../components/core/Layout/Layout.test.tsx) and
[actual interactive stories](../../components/core/Layout/Layout.stories.tsx). The dedicated compiler
project exercises valid native refs/events/aria and named responsive layout alongside forbidden
numeric/custom gap, visual overrides, reserved marker, known spread, custom renderer and invalid grid
span cases. Behavior tests cover fallback propagation, runtime projection, persistent draft/ref
identity during reflow, existing 7/5 layout, parent validation, inset axes and container/spacer behavior.
The interactive story uses production Core inputs/buttons and production message keys under the shared
locale/theme provider; its play function edits the draft and adds a real preview cell.

Compile with `pnpm design-system:typecheck`; run the Layout Vitest suite and
`pnpm storybook:typecheck`. New Layout source lint and stylesheet checks are required independently.
The [layout policy](layout-ownership-policy.md) lists consumers subject to the additional strict layout
gate and the scanner limits. Actual route coverage is tracked by the generated preview catalog.

## Input and specialist adapters

Core Input and Field expose closed size, density, value and state contracts with runtime attribute
projection and positive/negative type proof. [Input contract](input-contract.md) records their APIs
and validation. Shared toolbar and processing overlay frames own repeated editor chrome; executable
frames use Core SectionCard and LayoutInset. Authored canvas/source geometry remains local.

- SocialIcon/Glyph use named sizes from the existing font scale and reject SVG presentation overrides
  in types, runtime and ownership checks. ResizeHandle owns placement, visibility, keyboard focus and
  reduced motion; editor consumers pass interaction state through named props.
- MonacoSourceEditor owns font, density, chrome, notation colors and motion through its shared
  presentation adapter. Comments and numeric notation reuse document green; keywords, types and
  markup names reuse document blue; strings and regular expressions reuse document red. Identifiers,
  punctuation and operators use primary text. Inherited VS language-specific color rules and paired
  brackets follow the same palette. The installed Monaco matcher is checked against all four presets'
  editor, line-highlight, selection and search surfaces. The JavaScript Syntax Contrast story measures
  actual rendered tokens under the selected header theme. Its code viewport uses LTR notation under
  RTL pages while keeping localized accessible labels. Consumers can configure only the documented
  editing behavior options. These checks do not establish every grammar or assistive technology path.
  ImageCropper owns
  vendor selection, handle, overlay and focus appearance through its scoped Core adapter stylesheet.
- EditorMediaBlockFrame owns persistent selection and a separate keyboard focus boundary. External
  video consumes the frame selection outline. Editor toolbar toggle actions project
  pressed accessibility state. P5 capability controls compose SelectionRow and Checkbox without
  nesting labels, and Shader API references use Core Disclosure.
- Shader mode changes preserve an existing exact block/container selection within the same markup
  transaction; source-mode changes must not select or autofocus a neighboring Mermaid block.
  Shared selection toolbar actions preserve pointer selection at the Core button target, where React
  Aria press handling stops event propagation before a parent toolbar guard can run. Keyboard toolbar
  navigation and activation remain available.
- Release artist, label and credit connection commands consume neutral/medium Button emphasis.
  Public document table styles use the shared `data-geul-theme` contract for dark mode.
  Newly created default email HTML serializes the existing invariant paper text, ink and border roles;
  stored user-authored email content remains its own document data.
- Product disclosures must use Core Disclosure. The ownership scanner permits native summary only
  in `app/editor-lab-local/EditorInteractionLab.tsx`, a development diagnostic owner. This narrow
  exception does not authorize native disclosure skins in product Features.
- CSS and runtime font references are checked against `lib/styles/font-assignment.css`, including
  cache invalidation. Undefined font variables cannot be hidden in the token baseline.

Negative type and runtime fixtures, ownership scanner regression tests and actual owner Storybook
states cover these boundaries. Token baseline updates may remove obsolete occurrences only.

## Token and runtime authority

The token baseline is empty. New violations fail; do not add allowances to make a change pass.
Authored palette rendering, document serialization, map identity and geometry, private variable
producers and nested Callout behavior retain their dedicated regression tests and owner stories.

- Product spacing and typography use the shared scale. Callout glyph clearance and drag gutters
  derive from the actual Core control geometry.
- Browser safe-area values remain environment inputs. Component, map, pagination and scene variables
  are private owner contracts. Persisted scene, map and document geometry remain authored data.
- Durable editor color names consume document text/background roles through `authoredEditorPalettes`.
  Generated projections cover system and explicit themes. Map provider identities retain their
  exact shared brand values; valid user colors are preserved.
- Site branding has one canonical `brand-color` fallback and a validated adapter that projects only
  that role. Document anchor clearance uses `chrome-scroll-offset` at the shared sm breakpoint.
- PostCSS light/dark mixins consume `data-geul-theme`, matching the actual provider. Their regression
  tests compile the real Core stylesheet and root/where mixins.
- Locale font assignments and site-brand projection have exact shared owners. Generated authored
  color references and runtime setters reject unknown roles; unrelated declarations remain rejected.

## User-authorized semantic action treatment

An explicit user request may authorize a scoped change to semantic color or emphasis. Keep the
implementation in the shared token/Core authority, document the affected consumers, and verify the
Light/Dark states. Feature-owned confirmation intent is implemented in `features/confirmation`;
Feature CSS cannot supply an independent button palette. See [confirmation contract](confirmation-contract.md).

Feature UI may import the exact pure presentation entry
`@/features/confirmation/ui/ConfirmationDialog`. Its intent mapping is a local static module, and
it imports only Core. The enforcement rules continue to reject the confirmation barrel, imperative
host adapter and bulk command hook from UI, and every Feature import from Core. This is an owned
presentation composition, not a general exception for cross-Feature controllers.
