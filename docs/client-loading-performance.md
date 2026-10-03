# Client loading measurements

The baseline is immutable Web v0.4.0 commit `1dcdc92` at
`/Volumes/dev/dsub/.perf-geul-web-before`. Dependencies were installed with
`pnpm install --frozen-lockfile --offline` using the existing store, with no
downloads. Node is 24.19.0, pnpm is 11.22.0, Next is 16.3.1, and esbuild is
0.28.2. The baseline and final use the same lockfile and default production
Turbopack configuration. Neither build uses `LOCAL_CONTRACTS`, webpack,
`RELEASE_IMAGE_BUILD`, dotenv files, or production credentials.

## Repeatable commands

Run the harness from the final checkout, passing either isolated source tree:

```sh
node scripts/performance/client-loading.mjs /Volumes/dev/dsub/.perf-geul-web-before
node scripts/performance/client-loading.mjs /Volumes/dev/dsub/.perf-geul-web-after
node scripts/performance/next-client-build.mjs /Volumes/dev/dsub/.perf-geul-web-before build
node scripts/performance/next-client-build.mjs /Volumes/dev/dsub/.perf-geul-web-after build
node scripts/performance/next-client-build.mjs /Volumes/dev/dsub/.perf-geul-web-before analyze
node scripts/performance/next-client-build.mjs /Volumes/dev/dsub/.perf-geul-web-after analyze
```

These paths are disposable worktrees, not a requirement of the harness. From
the committed implementation checkout, reproduce elsewhere with the baseline
and current implementation in separate detached worktrees:

```sh
git worktree add --detach /tmp/geul-before 1dcdc92e1a6705364cd97e566e7f237e4b70cd63
git worktree add --detach /tmp/geul-after HEAD
```

For an optional uncommitted comparison, create the final worktree at the source
checkout's HEAD, apply that checkout's dirty tracked diff, and copy requested
new source files reported by `git ls-files --others --exclude-standard` with
their relative paths. Exclude local instruction files and all dotenv files.
Record the source HEAD and patch/new-file fingerprints for that comparison.

Install each tree with
`pnpm install --frozen-lockfile --offline`; if the store is unavailable, fetch the
same frozen lockfile first and disclose that setup difference. Pass those tree
paths to the scripts above. Committed comparisons need no patch/new-file overlay.

Read the production emitted JS/CSS asset graph with:

```sh
node scripts/performance/next-assets.mjs /tmp/geul-before
node scripts/performance/next-assets.mjs /tmp/geul-after
```

Serialize the full builds and analyzer runs. The wrapper rejects dotenv files
and supplies only the public placeholders specified by the Dockerfile. Next
automatically reads dotenv files, even without dotenv-cli. Final snapshots must
copy tracked and nonignored source files only, excluding Git metadata,
dependencies, ignored files, and generated output. Install frozen/offline
dependencies independently in each snapshot.

`next experimental-analyze --output` writes Turbopack graph data beneath
`.next/diagnostics/analyze`; it is an analyzer compilation, not a runnable
application build. Run `next build` separately to validate the application.

## Isolated compiled fixtures

The read-only fixture harness writes all compilation output in memory. It
exports one named symbol for each fixture, minifies ESM for ES2022, enables
splitting, and sums gzip level 9 bytes separately for the entry's static closure
and for all emitted chunks. It records package/lockfile hashes and retained
heavy modules. Next modules and private contract packages are external; CSS and
fonts are omitted. The fixture is identical for both source revisions.

These numbers describe isolated esbuild fixtures. They are neither Next route
bundle sizes nor measured browser downloads. All async chunks are a possible
graph total, not the bytes a specific language/video request necessarily loads.
The full Shiki language registry remains available; the optimization removes
unused themes, while preserving embedded grammars and language aliases.

| Fixture                     | Before static gzip | After static gzip | Before all chunks gzip | After all chunks gzip |
| --------------------------- | -----------------: | ----------------: | ---------------------: | --------------------: |
| TextInput via barrel        |             89,382 |            79,659 |                 89,998 |                79,922 |
| Session expired dialog      |            136,883 |            46,155 |                139,592 |                46,323 |
| Read-only layout via barrel |             89,766 |             1,136 |                 90,730 |                 1,643 |
| VideoPlayer                 |            237,556 |            28,808 |                237,556 |               238,206 |
| PrintCodeSource             |              3,995 |             3,994 |              1,879,525 |             1,637,057 |

Values are bytes. Baseline static Input/dialog/layout closures retain DateTimeInput and FileDropzone; final closures do not. Baseline VideoPlayer retains video.js statically; final defers it. Video total grows by 650 gzip bytes: this is deferral, not removal. Print full possible async graph shrinks by 242,468 gzip bytes; actual language loads only relevant chunks.

## Serialized catalogues

The harness invokes the actual selectClientMessages function in both trees and serializes UTF-8 JSON.stringify output with gzip level 9. These are catalogue bytes, not HTTP/HTML/RSC transfer.

| Locale/context          | Before raw | After raw | Before gzip | After gzip |
| ----------------------- | ---------: | --------: | ----------: | ---------: |
| en/homepage             |     58,915 |    60,112 |      18,308 |     18,724 |
| en/postDetail           |    153,201 |    60,112 |      45,345 |     18,724 |
| en/authenticatedControl |    153,201 |   153,201 |      45,345 |     45,345 |
| ko/homepage             |     68,450 |    69,852 |      21,026 |     21,457 |
| ko/postDetail           |    178,210 |    69,852 |      51,007 |     21,457 |
| ko/authenticatedControl |    178,210 |   178,210 |      51,007 |     51,007 |

Homepage catalogue grows by 416 EN / 431 KO gzip bytes because programEventAdmin includes public event messages and is now retained. This avoids missing translations. Anonymous post detail shrinks by 26,621 EN / 29,550 KO gzip bytes. Authenticated full catalogues remain unchanged.

## Evidence provenance

Raw fixture evidence: /tmp/geul-perf-before-fixtures.json and /tmp/geul-perf-after-fixtures.json. Reports include per-fixture source input fingerprints and package/lockfile hashes. Both worktrees start at 1dcdc92e1a6705364cd97e566e7f237e4b70cd63; final overlays uncommitted changes and is not a clean release commit. Snapshot contains no dotenv files or ignored secrets. Baseline source remains clean.

Initial final snapshot tracked patch SHA256: 1e61555b93d189bea056b27c10c0d2edeab94683652d233daf5e23fe37893cee. Tracked-plus-nonignored source tree SHA256: 161982363ff34cf0ab40393876282b1226a70559e4402c703c659c0bc7a84014. Source tree hash includes new files; patch hash alone omits them. Record: /tmp/geul-perf-after-provenance.json.

Both full Next builds passed TypeScript and prerendering. Logs: `/tmp/geul-perf-before-build.log` and `/tmp/geul-perf-after-build.log`. Analyzer runs are separate and remain explicitly identified below.

## Production emitted asset graph

Fresh default-Turbopack application builds emit the following whole JS/CSS
chunk graph, including all lazy chunks. No route-load or browser-transfer claim
is made. `next-assets.mjs` sums per-file gzip level 9 and records SHA256s.

| Kind | Before files | After files | Before raw |  After raw | Before gzip | After gzip |
| ---- | -----------: | ----------: | ---------: | ---------: | ----------: | ---------: |
| JS   |          962 |         912 | 58,120,276 | 57,040,437 |  14,661,144 | 14,492,557 |
| CSS  |           26 |          27 |    791,045 |    791,045 |     129,011 |    129,279 |

JS emitted gzip decreases by 168,587 bytes. CSS raw is unchanged; splitting
adds 268 gzip bytes. Build IDs: baseline `Vk58HTMJDe0-cs82jp4Fw`, final
`W_jI2515BorpGw_yTZRrx`. Both lockfile SHA256s are
`a7603ae2b3532129d5a3b4cee6da0e6c8dffeb9ffca52eca1430202edd0ea3c8`.
Reports: `/tmp/geul-perf-before-assets.json`, `/tmp/geul-perf-after-assets.json`.

The Turbopack analyzer is separate from the full builds. For its post-detail
client-reachable graph, including lazy imports, Shiki themes decrease from 65
to 2 (`github-light` and `github-dark`). Both analyzer runs passed. Logs are
`/tmp/geul-perf-before-analyze.log` and `/tmp/geul-perf-after-analyze.log`;
summary reports are `/tmp/geul-perf-before-analyze-summary.json` and
`/tmp/geul-perf-after-analyze-summary.json`. The repeatable reader targets
Next 16.3.1's analyzer format:

```sh
node scripts/performance/next-analyzer-themes.mjs /tmp/geul-before
node scripts/performance/next-analyzer-themes.mjs /tmp/geul-after
```

## Limits and runtime follow-up

Cold build speed is not compared: concurrent agent tests and operating-system
caches make a one-shot duration unfair. Build completion is validation only.
Production transfer, execution time, first playback, printing, and memory were
not measured by this harness. No percentage improvement in those outcomes is
inferred from fixture size or module count.

For browser verification, use the same Firefox version, viewport, CPU/network
conditions, locale, session, seeded content, and empty cache. Measure unique
requested JS/CSS encoded bytes at initial settle and first interaction for
text-only, video, executable, and map-containing content. Separately record
video-ready latency, print correctness, and language-specific highlighting.
Repeat serialized runs and report medians. Measure HTML/RSC and serialized
message catalogue bytes separately from JavaScript; catalogue JSON gzip is
not an actual route transfer measurement.
