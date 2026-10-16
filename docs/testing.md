# Test projects

`pnpm test` runs every Vitest project. CI runs the same complete collection in
one `Tests` job with one Vitest invocation across all four projects. The project
boundaries select runtime setup; they do not create separate CI processes.
The same job then runs the Storybook CI scope in one Jest test invocation.
Every applicable job still gates `Validate`; no changed-file selection narrows
these test collections.

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

The `Tests` job obtains its worker limit from `node:os.availableParallelism()`
and runs `pnpm exec vitest run --fileParallelism --maxWorkers "$CI_TEST_WORKERS"`
once, without a project filter or shard. This includes every discovered file,
including the light/dark theme contrast contracts. Forks and file isolation stay
enabled; files run in parallel while individual tests retain their declared
concurrency behavior. Design-system Node contracts also use the measured CPU
limit. Vitest and Storybook run as sequential steps, so their worker pools do not
compete with each other in that job.

The workflow targets the repository-scoped ARC label `geul-web-mini` on node
`mini`, with zero idle runners and at most one active runner. Its pod requests
and limits eight CPUs and has a 12 GiB memory budget; the node's reported capacity
is eight CPUs and about 15.5 GiB RAM. Deployment PR 372 was merged and Flux
reported `InstallSucceeded`; scale set `geul-web-mini` is registered with ID 1
and phase `Running`, and the listener controller is Ready with a 100m CPU request.
Zero runner pods at the configured idle minimum of zero is expected. These
control-plane checks do not yet establish an executed eight-worker test run or
cancellation behavior; those still require job logs and browser artifacts.

Measure changes using the complete `Tests` job and its individual step durations.
Vitest phase percentages can include parallel or overlapping work and are not an
additive wall-time breakdown. The `Tests` job includes Storybook preparation and
build time; the separate hosted `quality` job includes the Next build.

## Storybook browser isolation and CI parallelism

The single `Tests` job depends on `scope` and `format` and starts alongside the
hosted `quality` job. On `geul-web-mini`, it runs design-system Node contracts and
the full Vitest collection, then Storybook typechecking, MapLibre/p5 preparation,
one Storybook build, one pinned Linux Go-helper compilation, Chromium setup and
the `ci` browser suite. All steps use the same job workspace. There is no separate
Storybook build job or intermediate artifact download.

`Validate` requires `scope`, `format`, `quality` and `test` and runs only when the
workflow has not been cancelled. Storybook build/browser failures remain failures
of `Tests`. These describe configured gates; execution evidence belongs to the
tested commit and CI run.

The installed `@storybook/test-runner` 0.26.0 groups generated Jest files by CSF
title. Each former smoke command selected one title, so workers or Jest shards
alone could not distribute its stories. `scripts/test/storybook-browser.mjs`
uses the runner's exported `testPrefixer` and a Babel emitter to create one Jest
file per story. The official play function, pre/post hooks, error handling and
navigation retry remain in use. The `ci` suite is the deduplicated union of the
former selections: `a11y-smoke` with `core-interaction-accessibility`,
`a11y-author` with `pages-editors-post`, and `email-rendering`. It neither removes
those cases nor broadens CI to every catalog story.

Selection sorts story IDs before per-story file generation. CI assigns the
complete union to `1/1`, so one Jest invocation schedules every selected story.
The adapter retains deterministic modulo sharding for focused commands, with a
regression for disjoint assignments and full selected-scope coverage. Jest
receives no second shard option; random run directories never affect membership.

The browser test invocation is:

```sh
pnpm storybook:test:ci --suite ci --shard 1/1 --static-dir .artifacts/storybook-build/site
```

The adapter also queries Jest once with `--showConfig` before the test invocation;
that configuration query does not run a second test collection.

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
`.artifacts/storybook/<suite>-<shard>-<run>/` directory. The browser step serves
the Storybook build produced earlier in that same workspace as read-only input.
At the end of `Tests`, two review artifacts are uploaded: `storybook-build`
contains the site, Linux helper and renderer revision; `storybook-ci` contains
browser results and context evidence. Both use `!cancelled()`, preserving any
available evidence after failure while skipping uploads for cancelled runs.

Workflow concurrency groups PR and dispatch runs by workflow and branch
(`${{ github.workflow }}-${{ github.head_ref || github.ref_name }}`) and sets
`cancel-in-progress: true`. A newer run on that branch cancels its predecessor;
different branches retain their own runs. There is no global test-job group
that cancels unrelated PRs. Pull requests to `main` have no path exclusion, so
workflow and `.github/**` metadata changes also create a new run and enter that
same-branch cancellation group. `Scope` still fast-skips heavy checks for the
existing Release Please metadata-only PR case.

On cancellation or final cleanup, the browser adapter sends SIGTERM to its
detached Jest process group, including its Jest workers. It checks the group
for up to two seconds and sends SIGKILL if it remains. `finally` awaits that
signal/escalation routine and closes the owned preview server; completing the
routine does not itself prove that every descendant has exited.

Playwright 1.64 launches Chromium in a separate detached process group, so the
Jest group signals do not cover Chromium. Normal Playwright parent cleanup and
per-story context teardown own browser shutdown. The ARC ephemeral runner pod's
deletion is the final containment boundary that terminates remaining job
processes, including browsers. Cancellation evidence must distinguish group
signal escalation, browser/context teardown and runner-pod removal. Those
runtime observations remain to be recorded for the deployed runner.

The artifact also contains the Go `cmd/email-preview-fixture` helper built from
API revision `7155b62b9be580753f2187ec85fb2b8eed9dcd94`. The workflow requires a
40-character immutable SHA, checks the renderer checkout's HEAD, and records it
in `api-revision.txt`. Using that checkout's `go.mod` toolchain, `Tests` compiles
one `CGO_ENABLED=0` Linux/amd64 binary and passes its path through
`EMAIL_PREVIEW_FIXTURE_BINARY` to the same-origin fixture handler. The current
workflow does not cross-compile a Mac helper. The local visual review used the
Darwin/arm64 helper already obtained from the earlier hosted run; that is
historical review evidence, not a current CI build target. See
[email rendering](design-system/email-preview-rendering.md) for renderer parity
and quote ownership.

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
stories save screenshots. CI preserves available results after failure and skips
artifact uploads after cancellation.

Focused fixture contracts cover scope preservation, per-story emission, the
CI-only CPU query, success/failure context disposal, and independent static
server ports, data and shutdown. Their presence describes regression coverage;
actual CI scheduling and browser success require the artifacts from a completed
run. The earlier hosted [run 38884609657](https://github.com/echovisionlab/geul-web/actions/runs/38884609657)
recorded passes for its five Vitest jobs, Storybook build and four Core/Post
browser jobs. Its email browser stage exposed an iframe-readiness failure;
the subsequent fix and this consolidated workflow need their own run evidence.
That older run does not establish a pass, scheduling behavior, or timing change
for the new setup. Local visual review inspected `TemplateRichFormatting` with
the production editor component and CI-built Mac Go helper, including the quote
rule and live editor/iframe update; [email rendering](design-system/email-preview-rendering.md#quote-ownership-and-parity-evidence)
records that scope. Deployed application and mail-client acceptance remain
separate checks.

Application release and deployment remain on hold at the user's request;
producing test artifacts does not publish a site or Docker image.
Production, Storybook and delivered-email visual reviews retain
separate evidence.
