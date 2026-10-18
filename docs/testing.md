# Writing tests

A test earns its place by failing when user-visible behaviour breaks. Component tests use React Testing
Library through `@/test/render`, which wraps the application providers and returns a `user`
(`@testing-library/user-event`):

```tsx
import { render, screen } from '@/test/render';

it('saves the profile', async () => {
  const { user } = render(<ProfileForm onSave={save} />);
  await user.type(screen.getByLabelText('Nickname'), 'June');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Saved');
});
```

- Find elements by role, label or text (`getByRole`, `getByLabelText`), not CSS selectors, class names or
  `container.querySelector`. Markup can change; what the user perceives cannot.
- Wait with `findBy*` or a single `waitFor` assertion. No `setTimeout`, fixed sleeps or hand-written flush
  loops; drive timers with `vi.useFakeTimers()` and `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })`.
- Mock only external boundaries (network, server actions, browser APIs jsdom lacks). Do not mock Core
  components or the module under test; render the real tree.
- Each assertion must fail if the behaviour is wrong. Do not assert implementation details (call order of
  internal helpers, state shape) or restate the code under test.
- Extend an existing test before adding a new one; fold case matrices into `it.each`. A Storybook play test
  already covers an interaction in a real browser; do not duplicate it in jsdom.
- Keep a test fast: a component test that needs more than ~300ms is a defect to fix, not a timeout to raise.

## Deciding whether a test earns its place

This section applies the shared testing guide (`shared-ai-testing/v2`,
`~/.config/ai-guides/guides/testing-guide.md`) to this repository.

- Tie each test to a requirement, a public contract or a reproduced defect, and name the wrong behaviour it
  catches. Take expected values from that source, not from the current output, and do not copy production
  branches or formulas into the test.
- Run the real code under test. Mock external boundaries only; a test that mocks the logic it claims to
  check, or only asserts that a mock received what the code passed it, verifies nothing.
- Pin source text, markup, CSS values or a whole output only when that is the contract being protected.
  Test framework behaviour (React, zod, next-intl, React Aria) only when the test checks our configuration,
  wiring, extension or compatibility, or a past defect.
- A bug fix gets a regression test that fails before the fix and passes after it. For a new test, check
  that it fails when the behaviour is wrong; a controlled change to the code is enough where in doubt.
- Delete a test only after reading what it verifies and confirming that a remaining test asserts the same
  expectation, or that it protects no requirement. Never delete by category, name, length or coverage count.
- When a test fails, separate an implementation defect, a wrong test, a changed requirement and an
  environment problem. Do not change assertions, inputs or recorded outputs, or skip and mock the failure
  away, until the cause is understood.

`eslint-plugin-testing-library` enforces the query, waiting and container rules wherever a test uses
Testing Library or `@/test/render`. Older tests that render with `createRoot`/`act` move to this style when
they are next changed.

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

`scripts/test/vitest-projects.mts` discovers the existing `.test.ts` and `.test.tsx`
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
test-only runtime URLs from `test/runtime-env.mts`; shell variables cannot select
a running service stack. Stubbed environment variables restore between cases.
Forks, file parallelism, and Vitest file isolation remain enabled for every file that is not shared (below).

Files that cannot leak state run in a shared runtime: `node-unit-shared` and `component-shared` use
threads without per-file isolation, so module loading and the DOM environment are set up once per worker
instead of once per file. `sharesRuntime` in `scripts/test/vitest-projects.mts` decides from the source: no
`vi.mock`/`vi.doMock`, global or environment stubs, spies, fake timers or global redefinitions, and DOM files
must clean up what they render (Testing Library, or `unmount` in `afterEach`). A file whose module under
test keeps state across imports declares `// @geul-test-isolate: <reason>` and stays isolated. The shared
projects cut the local full run from 139s to 101s with the same 1,118 files; file-order shuffles
(`--sequence.shuffle.files`) pass. `pnpm test:unit` and `pnpm test:components` include both halves of their
tier.

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
Zero runner pods at the configured idle minimum of zero is expected. The active
runner pod was observed with eight CPUs, 12 GiB memory and `Guaranteed` QoS, and
its Node probe returned `os.availableParallelism() === 8`. Worker scheduling and
individual test results are recorded separately by each run's logs and artifacts.

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
browser results and context evidence. Both use the default successful-step
condition. A failed or cancelled step skips later test/build/upload steps; the
final Validate job still reports failed prerequisites.

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
processes, including browsers. Group signal escalation, browser/context teardown
and runner-pod removal are separate lifecycle boundaries.

Automatic cancellation was observed on 2026-10-16: pushing `994418e` completed
[run 38886951188](https://github.com/echovisionlab/geul-web/actions/runs/38886951188)
for `4eeb2dc` as `cancelled` at 10:27:12 UTC. A direct watch saw its runner pod
`geul-web-mini-7q8cg-runner-jzhl8` move through `Succeeded` to `DELETED`, and
[replacement run 38887252101](https://github.com/echovisionlab/geul-web/actions/runs/38887252101)
started automatically. No manual cancellation or pod deletion was used. This
records workflow cancellation and the final pod cleanup boundary; test outcomes
and browser teardown details remain attributable to their own execution records.

The artifact also contains the Go `cmd/email-preview-fixture` helper built from
API revision `d65f5f5105f36a01eb1866b493194be30648ec28`. The workflow requires a
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
server ports, data and shutdown. Each completed CI run's logs and artifacts
identify its tested commit, worker scheduling, scope and results. The CPU probe,
cancellation observation and local visual review are separate evidence from a
full-suite pass.

Local visual review inspected `TemplateRichFormatting` with the production
editor component and the earlier CI-built Mac Go helper, including the quote
rule and live editor/iframe update; [email rendering](design-system/email-preview-rendering.md#quote-ownership-and-parity-evidence)
records that scope. Deployed application and mail-client acceptance remain
separate checks.

Application release and deployment remain on hold at the user's request;
producing test artifacts does not publish a site or Docker image.
Production, Storybook and delivered-email visual reviews retain
separate evidence.
