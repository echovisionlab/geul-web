# Build performance

Measure local builds and CI jobs separately. The local machine, the two-CPU hosted
runner, and the eight-CPU `geul-web-mini` runner have different resource limits;
their elapsed times are not interchangeable.

## Baseline, 2026-10-18

The baseline is commit `2d3a04d191a405360792886b38f2b2a6556f6d7c`, with Next.js
16.3.8, TypeScript 7.0.2, Node.js 24.21.0, and pnpm 12.9.1. The full TypeScript
project has 7,274 files, including 1,113 test files. These measurements use the
published contract packages.

The local measurements use macOS on arm64 with 12 available CPUs and 32 GiB of
memory.

Two sequential local checks used a separate build-info file, starting without
that file. No other build or test command for this investigation ran concurrently.

```sh
/usr/bin/time -l pnpm exec tsc --noEmit --incremental \
  --tsBuildInfoFile .artifacts/build-performance/baseline-full.tsbuildinfo \
  --extendedDiagnostics
```

| Full TypeScript check | Elapsed | Maximum resident memory | Swap operations |
| --------------------- | ------: | ----------------------: | --------------: |
| Without build info    | 12.47 s |                5,717 MB |               0 |
| With build info       |  1.31 s |                1,229 MB |               0 |

Memory values use decimal MB. The warm result reused the first check's build
info with unchanged source. It demonstrates local incremental checking, not
GitHub cache restore performance or the cost of checking a source change.

Three successful hosted CI builds before the performance changes took 12m59s,
13m35s, and 15m12s for the Next build step. Their compile phases took about
3.4–3.9 minutes and their TypeScript phases about 9–11 minutes. All reported
that no build cache was found. The 44 static pages took less than one second;
static generation was not the long phase in these runs.

The [baseline run for this commit](https://github.com/echovisionlab/geul-web/actions/runs/39109532240)
completed its quality job in 18m33s. Its Next build took 13m33s, including a
3.8-minute compile and a 9.5-minute TypeScript phase. It also had no build cache;
static generation took 377 ms. The quality job's total includes runner
preparation, dependency installation, lint, other static checks, and the bundle
budget check.

The local cold check's memory use makes overlapping compiler processes a
candidate for investigation on an 8 GB runner. It does not establish that swap
caused the historical CI times. Measure runner memory, page faults, and swap
alongside elapsed time before assigning that cause.

## TypeScript projects and local builds

The full checker owns tests, tooling, and production source. Next builds use a
strict application project containing production roots and the selected build's
generated route types. Both keep `strict: true` and `skipLibCheck: false`.
Storybook's separate checker retains its existing test ownership and settings.
CI generates route types and runs the full checker before compiling the app;
the narrower Next project does not replace that required check.

| Mode                    | Full checker                    | Next build checker                  | Default output          |
| ----------------------- | ------------------------------- | ----------------------------------- | ----------------------- |
| Published contracts     | `tsconfig.json`                 | `tsconfig.app.json`                 | `.next`                 |
| Sibling contract source | `tsconfig.local-contracts.json` | `tsconfig.app.local-contracts.json` | `.next-local-contracts` |

`tsconfig.local-contracts-paths.json` owns sibling source aliases shared by the
two local projects. Full local and standalone app checks use separate
`.cache/typescript/*.tsbuildinfo` files. Next controls its own cache path under
the selected output directory.

Keep this inheritance chain to a single string `extends` per config. The
[Turbopack resolver shipped with Next 16.3.8](https://github.com/vercel/next.js/blob/v16.3.8/turbopack/crates/turbopack-resolve/src/typescript.rs)
reads string inheritance but does not traverse an `extends` array. TypeScript
accepts the array, so a successful compiler check alone cannot establish that
the bundler resolves the same aliases.

Generate types for the selected mode before standalone checks. Next rewrites
`next-env.d.ts` to reference that mode's generated route declarations, so repeat
type generation when switching modes.

```sh
pnpm exec next typegen
pnpm typecheck
pnpm typecheck:app
pnpm build

LOCAL_CONTRACTS=1 pnpm exec next typegen
pnpm typecheck:local-contracts
pnpm typecheck:app:local-contracts
pnpm build:local-contracts
```

An explicit `DIST_DIR` is supported by `next.config.mjs`. The configuration helper
creates a small app configuration under `.cache/typescript/` that includes only
that output's production route validator, alongside the production roots.
Next 16.3.8 does not automatically add generated includes to a config that uses
`extends`; the explicit selection prevents custom outputs from losing that
validation or including stale validators from another output.

After the split, sequential local checks with fresh, separate build-info files
gave these results. The full graph grew by the new configuration test and its
helper; its source/test scope was preserved. The full check's timing variation
from the earlier baseline is not attributed to the split, since its settings
are unchanged.

| Project                   | Files | Cold elapsed | Warm elapsed | Cold maximum resident memory |
| ------------------------- | ----: | -----------: | -----------: | ---------------------------: |
| Full, published contracts | 7,276 |       8.89 s |       0.97 s |                     5,764 MB |
| App, published contracts  | 5,675 |       5.82 s |       1.19 s |                     4,271 MB |
| Full, sibling contracts   | 7,277 |       9.29 s |       1.75 s |                     5,723 MB |
| App, sibling contracts    | 5,678 |       7.08 s |       0.88 s |                     4,284 MB |

These are compiler checks, not complete build timings. The app checker used
about 1.5 GB less resident memory than the full checker in this run. The full
checker still runs separately.

A published-contract build in a new custom output directory took 96.33 seconds;
the next build using that directory's filesystem cache took 16.25 seconds.
Compilation took 51 seconds and 4.3 seconds respectively. The first build's
36.5-second TypeScript phase overlapped a 36.9-second filesystem-cache write.
The total elapsed time, rather than the sum of those phases, is the comparison.
This checks local filesystem reuse and custom-output validation; it does not
include GitHub cache transfer.

The first successful sibling-contract build took 204.53 seconds and its next
cached build took 38.87 seconds. The first success followed a failed compilation
that had already created partial cache data, so it is not a clean cold baseline.
The host was using about 12 GB of swap after this pair; these observations do
not isolate the effect of source aliases or predict another machine's timings.

The filesystem-cache timing includes snapshot collection and serialization as
well as storage. Next runs this shutdown work alongside subsequent build steps.
It prints the persistence message only above 10 seconds; shorter writes still
appear in `turbopack-persistence` trace events. See the [versioned implementation](https://github.com/vercel/next.js/blob/v16.3.8/turbopack/crates/turbo-tasks-backend/src/backend/mod.rs#L1360).
Absence of the console message is not evidence that persistence was disabled.

The production trace is overwritten on each build. Preserve the cold trace
before running a warm build if snapshot and storage costs need separate analysis.
The retained warm traces report persistence of 0.142 seconds for the published
custom output and 0.209 seconds for sibling contracts. Their earlier cold
persistence details cannot be recovered from those overwritten traces.

## Version-specific decisions

- Next 16.3 enables the Turbopack build filesystem cache by default. An explicit
  flag alone does not add caching to this installation. CI must preserve the
  cache directory between jobs. See [Next's CI caching guide](https://nextjs.org/docs/app/guides/ci-build-caching)
  and [the filesystem-cache option](https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopackFileSystemCache).
- The project already enables `experimental.useTypeScriptCli`. Its TypeScript 7
  compiler runs as a native process, so increasing Node's heap limit does not
  set the compiler's native memory budget. See [Next 16.3's TypeScript support](https://nextjs.org/blog/next-16-3#faster-type-checking-with-typescript-7).
- Standalone `pnpm typecheck` writes `tsconfig.tsbuildinfo`. The installed Next
  CLI overrides the incremental path to `<distDir>/cache/.tsbuildinfo`. Preserve
  these separately; a cache of one is not a cache of the other.
- TypeScript `exclude` controls root discovery. An excluded file can still
  enter the graph through an import. Keep full-project checking as a required
  gate when measuring an application-only build project. See [TypeScript's
  exclude reference](https://www.typescriptlang.org/tsconfig/#exclude) and
  [Next's custom TypeScript configuration](https://nextjs.org/docs/app/api-reference/config/next-config-js/typescript).
- `next build --profile` profiles React production rendering. Use the installed
  CLI's CPU profiling support when investigating compiler work. See [Next CLI
  CPU profiling](https://nextjs.org/docs/app/api-reference/cli/next#cpu-profiling).

The supplied [Next.js build-performance article](https://oneuptime.com/blog/post/2026-01-24-nextjs-build-performance/view)
was also reviewed. Its general recommendations need version and workload checks:
Turbopack and native TypeScript are already enabled here, and a smaller client
bundle does not by itself prove a faster compile. The application already has a
custom image loader; changing request-time image handling does not address the
observed TypeScript phase. No application imports, rendering behavior, or bundle
budgets are changed on the strength of those recommendations alone.

## Comparing CI caches

Compare no cache, TypeScript build-info caches, and the complete Next build
cache. Record cache restore/save time and job elapsed time as well as command
elapsed time. A faster build with a slower cache transfer can increase total CI
time.

Use the same commit, lockfile, configuration, runner, and environment for each
comparison. Run benchmarks sequentially on `geul-web-mini`, which has one runner
pod at most. Keep benchmark caches separate from normal quality caches and from
other benchmark modes. A second build in the same job proves filesystem reuse;
a separate job restoring the saved cache is needed to measure GitHub transfer
and a cache hit.

GitHub cache entries are immutable and scoped by branch/ref. A pull-request merge
ref and a manual feature-branch dispatch do not necessarily share accessible
caches. See [GitHub's cache reference](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching).
Never skip a required check because a cache was restored.

Normal quality runs preserve the full and app TypeScript build-info files.
`quality_turbo_cache` opts into the larger Turbopack cache for a manual run while
its net benefit is being measured. All jobs explicitly cache the pnpm store and
still run `pnpm install --frozen-lockfile`.

The existing `CI` workflow exposes a terminal benchmark after `Validate`:

```sh
gh workflow run ci.yml --repo echovisionlab/geul-web \
  --ref feat/collection-sizes-and-reading-layout \
  -f benchmark_cache=all \
  -f benchmark_runner=both \
  -f benchmark_series=build-cache-20261018 \
  -f quality_turbo_cache=false
```

`benchmark_cache` selects `off`, `none`, `types`, `full`, or `all`.
`benchmark_runner` selects `ubuntu-24.04`, `geul-web-mini`, or `both`.
The matrix runs one job at a time. Use a new series for a first-miss experiment;
reuse that series and SHA when rerunning a completed types/full job to measure
an exact cache hit. Series names contain 1–40 letters, digits, underscores, or
hyphens. The benchmark namespace has no restore prefix and is separate from
normal quality caches. `none` clears build caches; all modes use the same pnpm
store cache, so this is not a dependency-installation cold-cache experiment.

Find the completed benchmark job's database ID, then rerun only that terminal
job. This preserves its original SHA/ref/inputs and does not repeat upstream
tests. Wait for each rerun to finish before starting another. See [GitHub's job
rerun API](https://docs.github.com/en/rest/actions/workflow-runs#re-run-a-job-from-a-workflow-run).

```sh
gh run view RUN_ID --repo echovisionlab/geul-web --json headSha,jobs
gh run rerun --repo echovisionlab/geul-web --job JOB_DATABASE_ID
```

The `build-performance-*` artifacts contain context, command logs, GNU time
results, and before/after resource snapshots. Run the same measurement wrapper
on Linux with:

```sh
node scripts/performance/measure-build-command.mjs --help
node scripts/performance/measure-build-command.mjs typecheck -- pnpm typecheck
```

The wrapper preserves command failures and forwards cancellation to the process
group. GNU time's maximum RSS is a maximum over the command and children, not
their summed simultaneous RSS. `/proc` observations can describe the host;
cgroup v2 snapshots separately record the current container's limits and events.
Cgroup `memory.peak` is cumulative and is not reset. Other group members and
ancestor limits can affect these observations. Unsupported or inaccessible
cgroup data is recorded as unavailable, rather than inferred.
