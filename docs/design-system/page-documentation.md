# Storybook page documentation

Open `Design System/Pages` to search routes, task groups and source files. The same
contracts appear in the Docs for mapped `Pages/*` groups. Open the existing page
stories to review production Views; documentation does not duplicate their implementations.

Documentation stays in English. The toolbar locale controls production UI and fixture
copy, while the active theme supplies the same Core tokens to documentation and examples.
Documentation neither changes those globals nor installs a separate provider.

## Ownership

| Definition                             | Owner                                                                                   |
| -------------------------------------- | --------------------------------------------------------------------------------------- |
| Production rendering and behavior      | App route, Feature View/controller and Core                                             |
| Static route/View correspondence       | `page-preview-coverage.json`, `ui-kit-route-index.json`                                 |
| User tasks and review criteria         | `stories/design-system/pages/page-docs.ts`                                              |
| Documentation navigation and rendering | `stories/design-system/pages/PageDocumentation.tsx`                                     |
| Data, callbacks and transport fixtures | Linked `stories/pages/*.stories.tsx` files and fixture imports                          |
| Execution results                      | Evidence for the executed story, state, viewport, theme, locale, input method and scope |

The documentation consumes Core Layout, Typography, Input, Section, Disclosure and
DataTableView. `StorybookLink` preserves toolbar globals between entries. Page
documentation does not define independent colors, spacing, breakpoints or controls.

## Read a page contract

1. Inspect the route pattern, entry kind, source path, SHA and disposition.
2. Read the user task and steps to reproduce it.
3. Identify the production owner and story fixture.
4. Read local behavior and server, permission, SSR, network and persistence exclusions.
5. Open the selected branch examples and exercise the supported default, empty,
   pending, failure and recovery states.
6. Check the args of other branches and mobile examples before using them.
7. Verify keyboard interaction, focus, names, state, error relationships, content
   and responsive behavior in the browser.

One CSF file can serve several routes: Posts/Pages, Terms/Privacy or Translation's
Overview/Jobs/Settings. Its exports are not all states of the selected route. The
documentation separates focused examples from other branches and states. A `Phone`
story uses its own args and does not establish mobile coverage for another route.

## Evidence and status

| Record               | Establishes                                     | Does not establish                                        |
| -------------------- | ----------------------------------------------- | --------------------------------------------------------- |
| Source mapping       | Static import/JSX and named View correspondence | Served route or all branches/states executed              |
| CSF example          | An export that reproduces a fixture             | Browser, design or accessibility approval                 |
| Review criterion     | A task and observable check                     | A completed execution                                     |
| Local fixture result | Its callback/transport implementation scope     | Service, permission, delivery, CAS or persistence success |
| Automated result     | Executed rules and scenarios                    | VoiceOver/Orca integration or complete WCAG conformance   |

When this catalog has no execution evidence, documentation says
`No result recorded in this catalog`. This is not an overall pass or failure count.
Record the actual environment, state, input method and evidence before reporting a result.

A View story does not make a route reachable when its parent layout terminates with
`notFound`. Redirect-only, development and provider entries retain their disposition
and source instead of inventing an independent page.

## Viewport and content review

| Review viewport  | Checks                                                                                                    |
| ---------------- | --------------------------------------------------------------------------------------------------------- |
| Mobile 390×844   | Long labels and errors, menus/toolbars, touch targets, virtual keyboard, page overflow                    |
| Tablet 834×1112  | Tabs, sidebars, column transitions, table/card density, orientations, touch/keyboard and breakpoint edges |
| Desktop 1440×900 | Maximum width, toolbar gaps, table/content scrolling, hover/focus, overlays and low heights               |

These dimensions are fixtures, not product breakpoints. Read Core Layout and inspect
immediately around actual boundaries. Switch supported locales and themes on the same
View. Check long/empty text, unbroken strings, 200% zoom and relevant input methods.
Separate intentional table/map/editor scrolling from general product UI overflow.

## Updates

Regenerate the existing inventory/coverage after route, View or story export changes.
The documentation reads that catalog directly and maintains no separate page-data snapshot.
Update `page-docs.ts` when a task or review criterion changes, then inspect its running story.
An unspecified task is a visible gap rather than an invented completion state.
