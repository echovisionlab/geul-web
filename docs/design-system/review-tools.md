# Run and record a design-system review

Use the project review tool for repeatable source, tooling and Storybook checks.
Review plans live in `design/storybook/review-plans/`; logs stay in the ignored
`.artifacts/design-system/reviews/<name>/` directory. Successful evidence is
published to `design/storybook/<name>-review.json`.

## Commands

Run from the repository root with the installed dependencies:

```sh
node scripts/design-system/review.mjs --help
node scripts/design-system/review.mjs run compact-product
node scripts/design-system/review.mjs status compact-product
node scripts/design-system/review.mjs record compact-product
```

The package alias is `pnpm design-system:review <command> <name>`.
The direct Node command is the tested primary path and also works when a local
pnpm shell wrapper cannot execute.

`run` regenerates documentation, runs the listed source tests with at most two
workers, runs native Node tooling tests, executes optional named checks, checks
generated contracts, type-checks Storybook, builds Storybook and runs the full
official Storybook test runner. Generation precedes the tested source snapshot
because generated documentation may legitimately change during generation.
The build uses installed package contracts. Unset `LOCAL_CONTRACTS`; sibling
checkout aliases are outside this review workflow. The default build sets
`UI_KIT_MINIFY=0`, as recorded in the phase environment and build identity.

The tool reuses a running preview. Its index, compiled iframe entry and built
inventory must match the current `storybook-static` build. If the preview is
unavailable or stale, start the existing server in another terminal:

```sh
node scripts/design-system/serve-kit.mjs
```

Then rerun the review. This tool does not create a server, add GUI automation or
change browser/account settings. The official runner owns its browser execution.

`status` prints phase status, log paths and actual source/tooling/story counts.
A failed or interrupted run remains inspectable. Rerunning archives the previous
working files under `history/` before using the same predictable filenames.

`record` is a separate action after reviewing manual notes and screenshots.
It only publishes `ready_for_review`; it never declares design approval,
deployment, assistive technology acceptance or live-service acceptance.

## Review plan

The filename is a lowercase name with letters, numbers and single hyphens,
starting with a letter. Traversal, absolute names and unknown plans are rejected.
All file paths are project-relative. A minimal plan has this structure:

```json
{
  "schemaVersion": 1,
  "title": "Example owner review",
  "scope": "The changed shared owner and its actual consumers.",
  "sourceTests": ["components/core/Progress/Progress.test.tsx"],
  "toolingTests": ["scripts/design-system"],
  "checks": [
    {
      "name": "core-types",
      "command": [
        "node",
        "node_modules/typescript/bin/tsc",
        "--noEmit",
        "--project",
        "components/core/tsconfig.type-test.json"
      ]
    }
  ],
  "build": { "minify": false },
  "storybook": { "url": "http://127.0.0.1:6010" },
  "criticalPaths": ["components/core/Progress", "components/core/LoadingSurface", "docs/design-system"],
  "manualNotes": "design/storybook/review-notes/example.json",
  "screenshots": ["design/storybook/previews/example/progress.png"],
  "priorRuns": [],
  "boundaries": ["Local fixtures do not verify backend persistence or native AT."]
}
```

`sourceTests` can also name a JSON file containing a test-file array. Tests are
explicit `.test.ts`, `.test.tsx`, `.test.js` or `.test.jsx` files, without duplicates.
`toolingTests` accepts `.test.mjs` files or directories; directory entries are
expanded without shell globs. Additional checks use literal Node argument arrays,
with optional string-valued `env`. They cannot override `HOME`, `home` or
`CODEX_HOME`. Keep credentials out of tracked plans and recorded environments.
The Storybook endpoint must be a loopback HTTP origin. Checks are local project
commands, not arbitrary GUI automation.

Critical files and directories are hashed recursively. The plan, listed test
files, package/lockfile and Storybook configuration join that snapshot automatically.
Include source CSS, feature owners, source documentation and relevant adapters;
do not put the output review record or `.artifacts` in `criticalPaths`.
Manual notes must contain a nonempty `observations` array. Describe the actual
scenario, viewport/theme/locale, observed result and any timing or fixture limits.
Screenshots are hashed at recording time. Their names do not prove that a scenario
was exercised; observations must explain that evidence.

## Reports and identity

| Working file                       | Meaning                                                                                        |
| ---------------------------------- | ---------------------------------------------------------------------------------------------- |
| `run.json`                         | Plan hash, phase commands/environments, times, exit results and report/log hashes              |
| `source-tests.json` / `.log`       | Affected Vitest report and process output                                                      |
| `tooling-tests.tap` / `.log`       | Actual native TAP counts and process output                                                    |
| `generate.log`, `check.log`        | Existing generation and design-system validation                                               |
| `checks/<name>.log`                | An optional plan check                                                                         |
| `storybook-types.log`, `build.log` | Type and build results                                                                         |
| `build-identity.json`              | Source/built inventories, index, compiled HTML/JS/CSS/JSON hashes and critical source snapshot |
| `storybook-tests.json` / `.log`    | Full official test-runner report and output                                                    |
| `history/`                         | Previous runs and replaced published records                                                   |

File counts come from `testResults` entries, rather than Vitest describe-suite
counters. Test counts come from actual assertions; tooling totals come from native
TAP. The browser report must cover every story in the current index, not only a
passing filtered subset. Failures, skipped/incomplete results, changed reports,
stale JSON timing, changed critical source/plan/CSS, altered build assets or
mismatched inventories prevent recording. Logs are printed by path; detailed
process output remains in its fixed file.

Build hashing excludes the copied `design-system-review/` evidence directory.
Compiled code and document inventory are identified; media and fonts require
explicit critical paths when they belong to the review scope. `priorRuns` records
and hashes earlier reports/logs without counting failed history as acceptance.
The published file includes the supplied manual notes and explicit boundaries.
Its static preview copy appears on the next Storybook build; recording does not
silently rebuild or modify the served bundle.

For owner, API and browser-review requirements, read the
[contribution process](./contribution.md). The existing release-readiness tool
produces planning matrices; the size/density browser tool is a specific regression.
This review CLI reuses validation and the official test runner instead of replacing
those owners with another UI automation system.

## Before/after screenshots for behaviour-preserving changes

`scripts/design-system/story-screenshot-compare.mjs` captures the same stories and interaction
states (hover with a real pointer entry, focus, click, key press) on two running Storybook servers,
for example a baseline snapshot of the tree and the working tree, and reports differing pixels per
case. Plans and images stay in ignored `.artifacts/` directories.

```sh
node scripts/design-system/story-screenshot-compare.mjs --plan <plan.json> --out <dir> \
  --before http://127.0.0.1:6132 --after http://127.0.0.1:6131
```

A zero-pixel result is evidence of parity only for the captured states; look at the images.

Entries can also script reading states: `{ "scroll": 1200 }` or `{ "scroll": "#heading-id" }`,
`{ "tab": 3 }`, `{ "move": [x, y] }` and `{ "drag": { "selector": "…", "from": 0.1, "to": 0.6,
"release": false, "pointer": "touch" } }` (a vertical drag across the element; `touch` dispatches real
touch points, so pointer handlers see `pointerType: "touch"`). `"touch": true` emulates a touch screen
(coarse pointer) and `"reducedMotion": "no-preference"` keeps animations. `"measure": { "title": "h1" }`
records the bounding box of each selector's first match (and the viewport) in `summary.json`, for
alignment and overflow evidence next to the images.

For print review, an entry may set `"media": "print"` (emulated print media for the screenshot)
and `"pdf": { "format": "A4" }` (Chromium's paged print path: `@page` margins, breaks and real
pagination, written next to the PNG). `--label <name>` replaces the `before` file suffix when one
running server is captured across phases. Render every page of a PDF into one contact sheet
(macOS PDFKit) to inspect margins and break placement:

```sh
node scripts/design-system/story-screenshot-compare.mjs --plan <plan.json> --out <dir> \
  --before http://127.0.0.1:6010 --label after
swift scripts/design-system/pdf-contact-sheet.swift <dir>/<name>.after.pdf <dir>/<name>.after.pages.png 4 420
```

## Spacing relationship audit

`scripts/design-system/spacing-audit.mjs` inventories and measures spacing relationships.

```sh
node scripts/design-system/spacing-audit.mjs static
node scripts/design-system/spacing-audit.mjs measure --label before --widths 1440,390 --theme light
node scripts/design-system/spacing-audit.mjs measure --label after --stories core-layout-field--state-matrix
```

`static` lists Layout props (including `Ds*` aliases) classified by the relationship their
children express, CSS spacing values, literal/`calc()` bypasses and inline style spacing.
`measure` opens stories in the running Storybook (default `http://127.0.0.1:6010`), records
vertical gaps between visible siblings (including dialog and menu portals) and label →
control → help gaps, and saves full-page screenshots. Output stays in
`.artifacts/design-system/reviews/spacing-audit/`. Text gaps are box gaps; an inline label's
glyph box reads about 1px larger than its line box. Look at the screenshots.

## Typography role audit

`scripts/design-system/typography-audit.mjs` inventories and measures type roles.

```sh
node scripts/design-system/typography-audit.mjs static
node scripts/design-system/typography-audit.mjs measure --label before --widths 390,834,1440 --themes light,dark
node scripts/design-system/typography-audit.mjs measure --label after --locales ar --stories pages-public-documents--post-heading-hierarchy
node scripts/design-system/typography-audit.mjs measure --label print --media print --themes light,dark,ocean-dark --pdf
node scripts/design-system/typography-audit.mjs measure --label before --out .artifacts/design-system/reviews/<name> --plan <stories.json>
node scripts/design-system/typography-audit.mjs compare <dir>/before/measure.json <dir>/after/measure.json
node scripts/design-system/typography-audit.mjs gaps <dir>/after/measure.json
```

`static` lists CSS `font-size`/`line-height`/`font` values (token, private, expression or
literal, print rules marked), feature CSS that sets a type size directly, Core `Text`/`Heading`/
`SupportingText` usage by prop combination (to find one role rendered at several sizes) and TS
inline/runtime font assignments. `measure` opens stories in the running Storybook, reads the
shared role sizes at the current width/media, records every visible text node's computed size,
flags sizes outside the roles (authored runtimes such as KaTeX, Monaco and maps are excluded),
reports the document hierarchy (title, body headings by authored level `data-heading-level`,
paragraph), every visible `.prose` heading (element, authored level, size, line height, box) and
the page outline (`h1` count, levels), and saves full-page screenshots. It also records the reading
measure (`reading`: width, leading and characters per full line of the first long published and
editor paragraph, spaces included, the last line excluded), the block rhythm (`blockGaps`: box gap
and kinds between consecutive blocks of every `.prose`, nested children, callout content and Tiptap
block group) and the outline clearance (`layout`: outline presentation, reading column and outline
boxes, the column's offset from the viewport center and the body/breakout → outline clearance in
the document direction). `gaps` pairs the editor and published gap above each block by block id
(blocks after an unpublished blank draft are reported as unpaired) and writes `gaps.md`. `--out` writes under another
review directory. `compare` matches two runs heading by id per story/width/media and fails when a
size, line height, weight, box or authored level differs (`compare.md` beside the second run). `--media print` emulates print at A4 width (794px); `--pdf` also writes the A4 PDF
for `pdf-contact-sheet.swift`. Output stays in `.artifacts/design-system/reviews/typography/audit/`.
Literal type sizes are enforced separately by `check-tokens.mjs` (`raw-font-size`).
