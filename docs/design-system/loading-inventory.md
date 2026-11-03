# Loading source inventory

Run the read-only census from the checkout with its existing dependencies:

```sh
node scripts/design-system/loading-inventory.mjs > /private/tmp/geul-loading-inventory.json
node scripts/design-system/loading-inventory.mjs --root /path/to/checkout > /private/tmp/other-loading-inventory.json
node scripts/design-system/loading-inventory.mjs --help
node --test scripts/design-system/meaningfulmatching.test.mjs
```

The caller chooses the output artifact. The tool writes JSON to stdout and errors to stderr; it does not update inventories, documentation, configuration or source files. Importing `collectLoadingInventory({ root })` runs the same census without invoking the CLI. It uses the installed `@typescript/tooling` compiler and the existing `filesUnder`/`projectPath` helpers in [review-data.mjs](../../scripts/design-system/review-data.mjs). It does not run the existing inventory generators.

## Scope and source identity

The census enumerates every file below `app`, `features`, `components` and `lib`, including providers and contexts. It parses production `.ts`, `.tsx`, `.js`, `.jsx`, `.mts`, `.mjs`, `.cts` and `.cjs` files. Missing roots appear as `present: false`. Immediate feature directories determine the domain list, so domains with no source or no candidates remain visible. The current application has 54 feature domains; the tool discovers that count rather than fixing it in code.

One exclusion function applies to scanning and import resolution. `excludedSources` records each excluded JS/TS path and its reason. Exclusions cover:

- Test, spec, type-test, story and explicit fixture filename suffixes, including `.test-fixture`, `.story-fixtures` and `-story-fixtures`.
- `test`, `tests`, `__tests__`, `testing`, `test-utils`, `spec`, `specs`, `__specs__`, `fixtures`, `__fixtures__`, `__mocks__`, `stories`, `__stories__` and `.storybook` directories.
- Declaration files and `node_modules`, `vendor`, `generated`, `gen` and `storybook-static` directories.

Production files such as route handlers, parsers and metadata helpers remain in scope even when they render no UI. CSS and assets contribute to `allFiles`/`nonSourceFiles`, but their contents are not read. The census does not read environment files, credentials or runtime environment values. It rejects symlinks through the existing review helpers.

`sourceManifest` contains every included path and its content SHA-256, sorted by path. `sourceIdentity.sourceManifestHash` hashes the UTF-8 sequence `file + NUL + sha256`, joined with newlines and no trailing newline. `enumerationHash` hashes the JSON object `{ all, domains }`, where `all` is the sorted list of every enumerated path and `domains` is the sorted feature directory list. Changes to excluded file contents do not change the production manifest. Their paths and exclusion reasons remain visible.

The identity also records the scanner hash, helper-module hash and TypeScript version. There are no timestamps, Git lookups or absolute checkout paths in the JSON. Identical inputs and tooling produce identical output. This identifies the inspected filesystem contents, including uncommitted changes, rather than a historical commit or generated inventory.

Before returning JSON, the tool repeats enumeration and checks every production file's content hash. If files changed during scanning, it fails before emitting JSON and names up to 12 changed production files. Rerun after the concurrent edits settle. This is an optimistic consistency check; it cannot provide an atomic filesystem snapshot or detect a file changed and restored between reads. Redirect stdout to a fresh temporary artifact and retain it only after exit code 0. Parse diagnostics remain explicit in `sources` and `totals`; a successful process exit does not approve incomplete syntax or loading behavior.

## Reading the JSON

| Field                               | Meaning                                                                                                                                                                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `totals`, `roots`, `domains`        | Included source, candidate files/nodes, lexical signal files/lines, named shared surface candidates, manual-required counts and candidate kinds. Zero-candidate domains are retained. Root totals also show all files and excluded sources. |
| `sourceManifest`, `excludedSources` | Sorted production content identity and excluded source paths/reasons.                                                                                                                                                                       |
| `sources`                           | Owner directory, parser diagnostics, value-import resolution and bounded lexical signals for every production source, including zero-match files.                                                                                           |
| `candidates`                        | AST evidence with path, content hash, 1-based line/column, kind, directory owner, enclosing function, context, conditions, snippet, import target, shared surface and unresolved classification.                                            |
| `namedSharedSurfaces`               | Explicit site/Core symbol identities with matching candidate IDs. Presence or reuse does not establish correct placement or message behavior. React Suspense identity also appears on candidate rows.                                       |
| `manualClassification`              | Required review fields and an explicit `not-performed` status. No approvals or migration baseline are generated.                                                                                                                            |
| `limits`                            | Detection and validation boundaries carried with the artifact.                                                                                                                                                                              |

`id` is `file:line:column:kind`; it locates a candidate within this snapshot. It is not stable across source edits. `owner` names the source directory responsibility, not an inferred person or team assignment. Multiple candidates can describe one wait: a Suspense boundary, its fallback, a PageLoader and a loading prop can overlap. Count or group reviewed waits separately; do not report candidate counts as defect counts, migration completion or semantic coverage.

Snippets and condition/attribute excerpts are whitespace-normalized and capped at 240 characters each. Open the hash-matched source to read the complete expression. Lexical snippets can include imports, comments, metadata, native loading policies and non-UI names. Their lines are separate triage evidence and are not added to AST candidate counts. A domain with zero AST candidates can still have lexical signals that need inspection.

## Detection and resolution

| Candidate kind                         | Evidence and review boundary                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `jsx-surface`                          | JSX names containing Loader, Loading, Skeleton, Spinner, Progress, Suspense or ProcessingOverlay; native `progress`; and aliases resolving to those exported symbols or the named shared definitions. A name can describe infrastructure or data display.                                                                                              |
| `pending-prop`                         | Camel-case or separator-delimited loading, pending, fetching, processing or busy tokens, including prefixes/suffixes such as `isLoadingMore`, `savePending`, `loadingSurface`, `onLoadingStageChange` and `aria-busy`. Literal `loading="lazy"`/`"eager"` is excluded from this kind.                                                                  |
| `pending-property`                     | Object properties with the same pending tokens and JSX, callback, null, text or reference values. These expose state-model content slots and non-UI properties for manual separation.                                                                                                                                                                  |
| `status-region`                        | Literal JSX `role="status"` or `role="progressbar"`. Its scope can be local feedback or measured data.                                                                                                                                                                                                                                                 |
| `suspense-fallback`                    | A boundary's fallback expression shape, including missing, null, JSX, empty fragments, callbacks and references.                                                                                                                                                                                                                                       |
| `dynamic-call`, `lazy-call`            | Resolved `next/dynamic` and React lazy imports, plus explicitly marked name-only matches. Dynamic loading options show callback return shapes, missing defaults and unresolved/spread options. Lazy identifies its enclosing Suspense responsibility rather than assigning a local fallback. Literal dynamic imports include their production targets. |
| `blank-return`                         | Explicit null, empty fragment/text/array returns, including concise arrow callbacks. Helpers remain visible as `non-render-or-unproven` unless there is render evidence.                                                                                                                                                                               |
| `blank-branch`, `blank-jsx-expression` | Explicit blank conditional outcomes in render candidates, or blank JSX expressions. A blank branch alone says nothing about loading.                                                                                                                                                                                                                   |
| `pending-branch`, `pending-text`       | Render-related if/conditional/logical branches with recognized pending condition tokens or literal loading-state comparisons; literal JSX text under those conditions. Translated text and references remain in branch snippets/outcome shapes for tracing.                                                                                            |
| `jsx-spread`                           | Unresolved prop forwarding that can carry pending props or surfaces. The census records the expression without assuming its contents.                                                                                                                                                                                                                  |

Import resolution follows the existing inventory's `@/` and relative production-module convention. It supports source extensions, index modules, JS-extension references to TS source, named/default aliases, namespace member access, named/local/default/star/namespace barrel exports and simple top-level identifier/member aliases. Type-only imports and reexports are excluded. Cycles terminate; ambiguous, external and unresolved targets remain explicit. Compiler path aliases beyond `@/`, package internals, CommonJS, computed imports, lexical shadowing, arbitrary wrapper/data flow and runtime slot contents require manual tracing. This is an AST resolver, without type checking or source execution.

Default-export expressions follow identifier and member aliases, including `export default UI.PageLoader` and `export default (PageLoader)`. Consumers can import either as `Wait` and retain the defining path and symbol. Unsupported expressions such as calls and computed property access remain unresolved; the resolver does not infer their output from a synthetic `default` symbol.

Shared identities require both the defining production path and exported symbol. Another domain's `PageLoader` name does not become the site loader. The named set includes site `PageLoader`, Core `PageLoaderView`, `ProcessingOverlay`, `Spinner`, `Skeleton`, `Progress`, `RouteProgressBar` and `NearEndLoader`. It records reuse and does not ban or approve any of them. `importTarget.origins[].via` retains the import/barrel route to the definition.

For the map phase path, inspect `features/map/MapLibreMap.tsx` rows: its `loadingSurface` prop contains the site PageLoader, whose `message` points to `loadingMessage`. The source's import record traces `useMapLoadingState` to its hook. Continue in the hash-matched controller, hook and runtime to establish phase messages and actual transitions. An imported phase type or story does not prove that every phase occurs at runtime. The same resolution identifies the site-to-Core loader and the provider's direct Core presentation without merging their configuration responsibilities.

## Owner classification record

Use the record fields and ownership distinctions below to classify waits in the current four-root source snapshot. Reconcile owner reviews against `domains`, including domains with zero candidates, and record reviewed states and remaining gaps before claiming a whole-site review. Candidate counts alone do not establish review coverage.

Keep manual reviews in a caller-owned artifact after inspecting source and the relevant states. The following is a proposed record shape, not a committed baseline or CI taxonomy:

```ts
type LoadingReview = {
  sourceManifestHash: string;
  file: string;
  sha256: string;
  line: number;
  candidateIds: string[];
  owner: string;
  status: 'unreviewed' | 'reviewed';
  waitScope:
    | 'site-blocking'
    | 'page-blocking'
    | 'section-blocking'
    | 'command'
    | 'field'
    | 'upload-processing'
    | 'playback-buffering'
    | 'incremental'
    | 'navigation'
    | 'background'
    | 'invisible-infrastructure'
    | 'data-display'
    | 'not-loading'
    | 'unknown';
  currentSurface: string | null;
  messageSource: string | null;
  disposition: 'commonize' | 'retain' | 'intentional-invisible' | 'exclude-non-loading' | 'needs-trace';
  reason: string;
  evidence: Array<{
    kind: 'source' | 'test' | 'story' | 'browser';
    location: string;
    inspectedState: string;
    remainingGap: string | null;
  }>;
  reviewer: string;
};
```

Use `unknown`, `needs-trace` and `unreviewed` while evidence is incomplete. Record the actual region replaced or retained, message/phase source, reason and evidence scope. Group overlapping candidate IDs only when they describe the same wait. Inspect lexical-only signals too; add a source-backed review record when they identify a wait outside AST detection. Reconcile changed hashes and relocated lines before reusing a prior decision. A zero-candidate domain still needs its owner to account for lexical signals, indirect imports and detection limits. Empty domains do not imply an approved UI state.

Apply these ownership distinctions and exceptions when reviewing each wait:

- Blocking page/section waits can receive site `PageLoader` from their controller through a `loadingSurface`/state-content slot or Core `DataTable.loadingContent`. Site owns settings and localization; Core `PageLoaderView` stays pure. Pure Feature Views must respect the existing import boundaries.
- Catalogue bootstrap uses root-resolved image props because its boundary precedes `ManifestProvider`. Check generic/phase text and no-image/failed-image behavior at that owner; source identity alone does not verify it.
- Commands, field checks, uploads, processing, playback buffering, continuation loading and route progress retain their own task scope. Existing content during background/incremental requests must be considered before replacing a region.
- JSON-LD Suspense, route observers, locale synchronization and helper null results can be intentionally invisible or unrelated to loading. Member-switch freezes require their security context. Preserve access checks, terminal errors and recovery ordering when reviewing a blocking wait.
- Map precursor skeletons, delayed chunks and on-demand overlays need their own path/state review. Do not infer that using the shared map loader covers every preceding wait.

No rule in this tool requires a loader for every await, bans Spinner/Skeleton/null or approves all existing rows. Semantic enforcement can be designed after owners finish the classification and agree on the taxonomy. There is no CI gate or migration pass percentage here.

## Remaining validation

Static detection cannot establish request timing, invisible/background intent, translation output, runtime ReactNode values or waits with unrecognized names. Lexical triage helps expose gaps such as imperative DOM/CSS adapters, but it also includes false positives. Source imports and stories do not prove loading-state coverage.

Owners still need actual production-view and Storybook inspection for relevant waits, with delayed bootstrap/chunks, generic and changing phase text, missing/failed images, GIF delivery/playback, containing-region placement, themes/locales, viewport sizes, retained content, errors/retry and permissions. This tooling task performs no browser, build, server, production or visual validation.

The focused synthetic tests exercise the real collector and CLI: alias/barrel resolution, chunk fallback outcomes, pending text versus helper nulls, prefixed/suffixed props, provider/context inclusion, consistent exclusions, zero-match domains, bounded snippets and deterministic content identity. They do not pin repository counts or substitute a copy of the matching implementation.
