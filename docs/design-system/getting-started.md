# Getting started with Geul design system

Use this repository's tokens, theme and Core components, and review the same implementation in Storybook.
Start at `Foundations / Overview`, find components in `Design System / Components`, and find product views in `Design System / Pages`.

## Run and review

```sh
pnpm storybook
pnpm storybook:typecheck
pnpm design-system:check
```

Storybook opens at `http://localhost:6010` by default.
For a static build, run `pnpm storybook:build`, then `pnpm storybook:preview`.
Change Theme, Locale and Viewport to inspect the same example.
Expanding a representative example runs the real Core or View with Controls.
A `Default` export appears first when available, followed by `Playground` and the named states.
The representative example uses the actual `Default`, then `Playground`, then the first available CSF example.
Controls change only the args connected by that example.
Use the state links to inspect loading, disabled, error, long content and composed examples separately.

## Use the system in the application

The design system lives in the application repository.
Use the existing app shell's `AppDesignSystemProvider`, locale provider and token CSS.
Do not redefine themes, CSS variables, colors or fonts per page.
The following example uses the actual Core API for an ordinary save command.

```tsx
import { Button } from '@/components/core/Button';

export function SaveAction({ onSave }: { onSave: () => void }) {
  return (
    <Button tone="neutral" emphasis="medium" onClick={onSave}>
      Save
    </Button>
  );
}
```

In product UI, resolve the label from locale messages and connect the callback to the real save operation.
Use `loading` while the request is pending, then connect failure feedback and retry behavior.
Read the [component documentation contract](./component-documentation.md) and the relevant Core documentation
for API unions, naming requirements and rejected props.
For composition, read [spacing and icons](./spacing-icon-contract.md) and [size and density](./size-density-contract.md).

## Documentation structure

| Location                                                       | Content                                                                                          |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Handbook / Getting Started, Contribution, Tokens and Changelog | Entry guidance, ownership, token intent, change proposals and change records                     |
| Foundations                                                    | Typography, spacing, icons, sizing, responsive behavior, specimen layout and accessibility rules |
| Core / Documentation                                           | Purpose, representative live example, anatomy, API, usage, tokens and states                     |
| Core / Playground and named state examples                     | Actual interaction, supported states, content and keyboard behavior                              |
| Design System / Usage Rules                                    | Paired examples of supported and incorrect composition for the same task                         |
| Design System / Patterns and Composition                       | Working forms, lists and input combinations built with Core                                      |
| Feature and Pages                                              | Product domains and production Views, fixture data and service boundaries                        |

A component's documentation follows Overview → Playground → states/features → recipes where those examples
are relevant. This order does not require an atomic component hierarchy.
Read the [page documentation contract](./page-documentation.md) for server, authorization, SSR and actual
assistive technology boundaries. Documentation registration and story counts are not verification results.

## Official writing references

- [How to document your design system](https://storybook.js.org/blog/how-to-document-your-design-system-best-practices-tools/): keep components, token intent, working compositions, paired usage examples and contribution rules discoverable together.
- [Structuring your Storybook](https://storybook.js.org/blog/structuring-your-storybook/): put entry and change guidance first, then distinguish explanation, Playground, states and recipes.
- [4 ways to document your design system](https://storybook.js.org/blog/4-ways-to-document-your-design-system-with-storybook/): combine real examples, source, API and guidance using the official Docs addon.

The implementation uses local Storybook 10.5.8 CSF and Doc Blocks APIs.
Reference articles' package names, old API examples and classification labels do not define the product API.
