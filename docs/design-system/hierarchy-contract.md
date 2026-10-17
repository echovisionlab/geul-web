# Hierarchy spacing contract

Hierarchy spacing consumes named design-system roles. A default is not a rule imposing one fixed pixel value on every screen.

## System definitions

- --geul-hierarchy-step: default ordinary child step, referring to existing spacing-lg. Currently 16px with a 16px root.
- --geul-hierarchy-reorder-step: compact reorder-row alignment to the parent label, referring to max(control-height-compact, interaction-minimum) + spacing-xxs. At the default root size, this is 32px for fine pointers and 48px for coarse pointers.
- components/core/design-tokens.ts owns values; the generator projects CSS. Do not introduce a separate numeric scale.

## Core usage

```tsx
// Ordinary hierarchy consumes the system default.
<HierarchyIndent>Child content</HierarchyIndent>

// Select an existing spacing token when the screen needs another hierarchy step.
<Hierarchy spacing="md">
  <Disclosure label="Parent" density="compact" defaultOpened>
    <Disclosure nested label="Child" density="compact">
      Content aligned with the child heading
    </Disclosure>
    <TextButton nested density="chrome" href="/child">Child link</TextButton>
  </Disclosure>
</Hierarchy>

// Details aligned with the parent reorder-row label.
<HierarchyIndent alignment="parent-label">Track details</HierarchyIndent>
```

Hierarchy supplies selected spacing to descendants. A nested Hierarchy without spacing inherits the parent selection. HierarchyIndent enabled=false omits that step's indentation. Arbitrary numbers/pixels/style overrides are not public APIs.

Disclosure nested represents a child group inside a body aligned with the parent label. Include the child's default heading inset so spacing is not applied twice. Control tracks own handled-row alignment.
contentIndent="label" aligns a body with its own heading; it remains distinct from a child step.

Navigation lists group links with Disclosure density="chrome": compact geometry (28px control, end chevron)
whose label starts on the chrome rows' xs 8px line, the same start as TextButton density="chrome" links and
SideNavigation items. Do not mix density="compact" groups with chrome links; their labels differ by 4px.

TextButton nested includes internal chrome padding in text alignment and prevents margin-based horizontal overflow on full-width links.
SectionCard nested includes internal padding and its leading border. SideNavigation consumes the same hierarchy role between group headings and child labels, accounting for icon tracks and active borders.
Selecting spacing smaller than required controls/markers/card insets does not remove them or overlap them with negative margins.

## Consumers

- Core SideNavigation, ParameterPanel and nested Disclosure/SectionCard/TextButton.
- Form field/settings/validation groups and recursive condition groups.
- Menu editing, recursively nested menu translation targets and Shell mobile menus.
- Comment depth, public credit groups and email-editor variable lists.
- Release-track details and ReorderRow parent-label alignment.
- Tiptap child blocks and public document child blocks share the default step. Directly nested HTML lists also avoid duplicated margin/marker padding.

Quote borders, callout icon insets, list-marker space, code tabs, print specifications and authored-page geometry retain their own roles.

## Verification

Storybook Core/Layout/Hierarchy/Contract shows the default and md choice using actual Core consumers. Foundations/Tokens Hierarchy defaults charts show the source relationships.
Type fixtures permit named spacing and reject numeric/style/Core-state escapes. Runtime contracts verify inheritance, preserved heading alignment and removal of bypass props.
Core ReorderGutter reserves an editor control track on touch. Document layout and authored hierarchy remain domain content.
