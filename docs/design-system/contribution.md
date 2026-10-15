# Changing and contributing to Geul design system

Start with an actual usage problem.
Review tokens, Core implementation, consumers and documentation in the same change, and record both results and unresolved items.

## Propose a change

Include the source, story, user task and conditions that reproduce the problem.
Record viewport, theme, locale, actual behavior and expected behavior.
First check whether existing Core APIs, states or compositions can express the requirement.
Explain why the existing parts are insufficient and which consumers are affected.
Propose a new Core component when it owns a reusable responsibility across domains.
Features own domain data, authorization, services and product-specific flows.
Reuse count alone does not decide adoption.

## Acceptance criteria

| Decision                     | Required evidence                                                                                                             |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Change existing Core         | A defect in its contract or a shared state/API required by actual consumers                                                   |
| Add Core                     | A distinct responsibility, public API, naming, interaction, states and token ownership                                        |
| Add a Composition or Pattern | A working arrangement of existing Core that solves a repeated task                                                            |
| Retain a Feature             | Domain data, authorization, services or a product-specific flow                                                               |
| Revise or defer a proposal   | Duplicated components, consumer-specific color/padding overrides, arbitrary state APIs or missing reproduction/usage evidence |

Assign review roles according to the change.
The proposer prepares reproduction and consumer evidence. Token/Core reviewers check meaning, API, composition and accessibility.
Reviewers of affected product consumers check actual tasks, responsive behavior, errors and recovery.
Assign reviewer names in the repository review for that change.

## Implement and document

1. Change the adopted token, theme or Core owner.
2. Update representative examples, supported states, Playground and actual consumers.
3. Update purpose, anatomy, use/avoid guidance, labeling, accessibility, tokens and compatibility.
4. Run `pnpm design-system:generate` to refresh documentation data and indexes.
5. Run `pnpm design-system:check`, `pnpm storybook:typecheck` and checks appropriate to the change.
6. Record actual browser results with viewport, theme, locale and interaction conditions.

Generated API and token references come from source.
Do not describe computed types, variables or runtime effects as proven by static extraction.
Record visual review, automated accessibility, keyboard and VoiceOver/Orca results with their separate execution scopes.
Do not mark every component or page passed when only a subset was reviewed.

## Compact presentation and custom themes

Compact composition and custom themes use the shared theme and token contract.
The current named registry is documented in the [system guide](../design-system.md#named-themes-and-compact-composition).
Keep theme appearance and interaction density explicit: choosing a theme must not silently shrink targets,
change keyboard behavior or add a Feature-local presentation authority.
Reuse existing size, spacing and density roles before proposing another role.

A theme proposal must identify its public selection API, semantic roles, Light/Dark behavior and actual consumers.
Check text, action, boundary, focus and status contrast in the supported surfaces and states.
Check compact layouts with long labels, translated content, keyboard focus and the shared coarse-pointer minimum.
Document supported combinations, defaults, migration and known limitations alongside real examples.
A requested theme is not an implemented or reviewed theme until the source change and evidence are recorded.

## Compatibility and change records

When public props, supported combinations, defaults or token meanings change, describe before/after behavior and affected consumers.
For breaking changes, provide consumer migration examples and the order of migration.
The repository currently does not version the design system as a separate published package.
Implementation and documentation are identified by the same Git change; application release records establish deployment status.
Record the date, change, owners, verification and migration in the [changelog](./changelog.md).
Do not label work before deployment as released.

References: [Storybook documentation guidance](https://storybook.js.org/blog/how-to-document-your-design-system-best-practices-tools/), [Storybook structure guidance](https://storybook.js.org/blog/structuring-your-storybook/).
