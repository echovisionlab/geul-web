# Test projects

`pnpm test` runs every Vitest project. CI runs the same complete collection as
independent project jobs, with two shards for components. Every applicable job
still gates `Validate`; project selection is not a changed-file-only CI shortcut.

| Project              | Boundary                                                                  | Command                |
| -------------------- | ------------------------------------------------------------------------- | ---------------------- |
| `node-unit`          | Node logic, policies, codecs, and mocked transports; no DOM or Next setup | `pnpm test:unit`       |
| `component`          | DOM components, SSR output, and offline preview controllers               | `pnpm test:components` |
| `server-contract`    | Route/request contracts with Next request semantics and mocked services   | `pnpm test:server`     |
| `editor-integration` | Tiptap DOM profiles, commands, and collaborative editor wiring            | `pnpm test:editor`     |

These boundaries describe the runtime fixture, not a claim that every Node test
replaces all collaborators. For example, a codec can use real in-memory Yjs data
without a service process. CRDT convergence, keyboard commands, profile guards,
and live structure locks retain their real editor integration tests.

`scripts/test/vitest-projects.ts` discovers the existing `.test.ts` and `.test.tsx`
files once when Vitest starts and assigns each to one project. Existing
`@vitest-environment` directives remain authoritative: SSR stays in Node and DOM
tests keep jsdom. Tiptap jsdom tests and editor `*.integration.test.*` files enter
the editor project; other DOM/SSR tests enter the component project. Remaining
app routes enter the server project; other logic enters Node. A leading
`// @geul-test-tier <project>` comment can state a boundary that the defaults
cannot infer. Restart watch mode after adding a new test file.

The project-discovery regression compares the complete Git test inventory
(including new tests) against project membership and rejects
missing or duplicate files. It also covers hidden Storybook files, literal Next
route names containing brackets and parentheses, and generated-output exclusions.
Existing test paths remain stable so targeted commands and documentation links
keep working. This inventory contract requires a Git checkout.

Node logic loads only a small transport fixture. Unmocked `fetch` rejects before
network access, and `vi.stubGlobal` replacements are restored after each case.
DOM and Next fixtures are not imported into that project. All projects use fixed
test-only runtime URLs from `test/runtime-env.ts`; shell variables cannot select
a running service stack. Stubbed environment variables restore between cases.
Forks, file parallelism, and Vitest file isolation remain enabled.

Keep per-test `vi.stubGlobal` fixtures in `beforeEach` with corresponding cleanup;
avoid fixtures that are installed only at module load and then removed by a
later case. Unmount React before destroying awareness and Yjs documents, and
perform that cleanup even when an assertion fails. Wait for observable state,
rather than assuming a request finishes after a fixed number of milliseconds.

Email variable/link normalization now has Node tests in `email-preview.test.ts`.
Policy validation and HTML serialization, including heading placement, unsafe
links/colors, callouts, and hard breaks, run in `policy-document.test.ts` without
mounting an editor. The profile suites retain the end-to-end in-memory wiring,
variable insertion, slash menus, keyboard handling, and rejected transactions;
the corresponding standalone policy/normalization cases are no longer repeated
inside those mounted suites.

Policy profile contracts retain editor disposal and replacement-controller
recovery. Media runtime contracts use deferred responses to cover stale ready
success/failure, resync completion after a newer event, and disabled subscriptions.
RPC target and response-header policies run in Node; route contracts retain
cookies, fallback transport, and response behavior with the Next adapter.

For a focused check across the new boundaries:

```sh
pnpm exec vitest run scripts/test/vitest-projects.test.ts test/node-isolation.test.ts features/editor/tiptap/profiles/email-preview.test.ts features/editor/tiptap/profiles/policy-document.test.ts features/editor/tiptap/profiles/EmailTiptapEditor.test.tsx features/editor/tiptap/profiles/PolicyTiptapEditor.test.tsx lib/auth.test.ts lib/api/server-client.test.ts lib/api/rpc-proxy.test.ts lib/media/use-media-processing-runtime-state.test.tsx lib/session-data.test.ts features/auth/hydra-mcp-oauth.test.ts 'app/api/rpc/[...path]/route.test.ts' stories/pages/TranslationAdmin.test.tsx
```

Use CI's per-project durations to measure any speed change. Vitest's phase
percentages can include parallel or overlapping work; they are not an additive
breakdown of elapsed wall time. Project separation does not measure or eliminate
the separate Next/Storybook build and browser-smoke costs.

## Storybook browser isolation and CI parallelism

Storybook browser checks run separately from the Vitest projects. CI builds
Storybook once in `storybook-build`, alongside the Next/static `quality` job,
and shares the build with five browser jobs: two Core accessibility shards,
two post-authoring shards, and one email-rendering contract. `Validate` requires
the Storybook build and every browser shard as well as the other applicable checks.
These are configured gates; execution evidence belongs to the tested commit and CI run.

The installed `@storybook/test-runner` 0.26.0 groups generated Jest files by CSF
title. Each former smoke command selected one title, so workers or Jest shards
alone could not distribute its stories. `scripts/test/storybook-browser.mjs`
uses the runner's exported `testPrefixer` and a Babel emitter to create one Jest
file per story. The official play function, pre/post hooks, error handling and
navigation retry remain in use. Selection preserves the existing intersections:
`a11y-smoke` with `core-interaction-accessibility`, and `a11y-author` with
`pages-editors-post`; the email suite selects `email-rendering`.

Selection sorts story IDs before assigning positions modulo the shard count.
A regression checks disjoint assignments and full selected-scope coverage.
Jest receives no second shard option: hashing files beneath independently random
run directories could assign overlapping or missing stories.

The CI invocation is, for example:

```sh
pnpm storybook:test:ci --suite a11y --shard 1/2 --static-dir .artifacts/storybook-build/site
```

Only `GITHUB_ACTIONS=true` together with `CI=true` or `CI=1` queries
`node:os.availableParallelism()` and passes the full result as Jest's explicit
`--maxWorkers`. The adapter first runs the installed Jest CLI with `--showConfig`,
requires its resolved `globalConfig.maxWorkers` to match, and writes `workers.json`.
Locally this adapter uses two workers without querying the machine's maximum,
including when tooling sets `CI=true` alone. Existing `storybook:test`,
`storybook:test:a11y`, and `storybook:test:author` commands retain their local
limit of two. `storybook:test:changed` retains four and transitive-dependent selection.

Each run owns a loopback static server bound to port zero, uses the port returned
by that listener, and closes it in `finally`. It never probes or reuses an
existing server. Test files, output and Jest cache live under a unique
`.artifacts/storybook/<suite>-<shard>-<run>/` directory. Browser jobs consume the
same read-only build artifact and do not rebuild Storybook.

The artifact also contains the Go `cmd/email-preview-fixture` helper built from
API revision `7155b62b9be580753f2187ec85fb2b8eed9dcd94`. The workflow requires a
40-character immutable SHA, checks the renderer checkout's HEAD, and records it
in `api-revision.txt`. Using that checkout's `go.mod` toolchain, CI builds
`CGO_ENABLED=0` Linux/amd64 and Darwin/arm64 binaries from the same revision.
Browser jobs restore the Linux binary's executable bit and set
`EMAIL_PREVIEW_FIXTURE_BINARY` for the same-origin fixture handler. For local
visual review, restore the downloaded Mac binary's executable bit and set that
variable before starting the normal Storybook preview. No local maximum-worker
run or local Go build is required. See [email rendering](design-system/email-preview-rendering.md)
for renderer parity and quote ownership.

`.storybook/test-environment.mjs` gives each story a fresh Playwright
BrowserContext and Page and closes them after success or failure. The first case
uses the runner's initial context; legacy local files containing several cases
reset the context between cases. The adapter calls `setupPage` once per context.
Separate contexts isolate cookies, local/session storage, module singleton queues,
document globals, timers, workers, navigation mocks, and mounted editors. A
storage sentinel checks for its own prior-context key before recording a new ID;
`storageWasEmpty` records this sentinel check, rather than a scan of every key.
Ordinary preview navigation and password storage are preserved across manual
story transitions. No general story-change storage clear or notification-queue
reset is installed.

Mounted fixtures also release their own resources: document locale attributes
restore the remaining nested/peer owner or original attributes; post access
plays address only their canvas's provider; pending file reads stop delivery and
insertion after owner disposal; local rooms discard queued acknowledgements after
destroy. These cleanup contracts also apply outside the CI browser runner.

In isolated CI, browser HTTP(S) requests outside the run's preview origin are
aborted and fail the case. `plan.json` records selected and assigned story IDs,
file count, CI parallelism and requested workers. `workers.json` records Jest's
resolved limit. Per-case records contain context ID, worker ID, disposal,
storage-sentinel status and blocked requests; `execution.json` aggregates them.
After an otherwise successful run, missing case evidence, reused context IDs,
missing disposal or storage evidence fail the adapter. CI also fails when at
least two CPUs and two completed cases produce only one Jest worker ID. Failed
stories save screenshots, and CI uploads results even when a run fails.

Focused fixture contracts cover scope preservation, per-story emission, the
CI-only CPU query, success/failure context disposal, and independent static
server ports, data and shutdown. Their presence describes regression coverage;
actual CI scheduling and browser success require the artifacts from a completed
run. No timing improvement, current-snapshot browser pass, or production visual
acceptance is established by this document. Release and deployment remain on
hold at the user's request; producing test artifacts does not publish a site or
Docker image. Production, Storybook and delivered-email visual reviews retain
separate evidence.
