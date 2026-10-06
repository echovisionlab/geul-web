# Page embed tool extraction: measured Web build boundary

Moving Transcode, YouTube Audio, HWP, and PortaDJ to independent mini servers reduced
the Web route inventory and logical emitted `.next` output. The single paired build
measurement did not show an overall Web build speedup. Tool-specific changes can now
build and redeploy their own server without changing or rebuilding the Web package.

## Conditions

The root ran the successful before/after snapshots with:

- Exact Node `24.21.0` and Next.js `16.3.8` on the same host.
- The same snapshot path: `.artifacts/page-embed-performance/snapshot`.
- Warm installed root/tooling dependencies and prepared public runtime assets.
- Cold `.next` output and cleared TypeScript build-info files before each measurement.
- Strict local-contract TypeScript checking, with release build bypass disabled.
- Explicit build placeholders and an isolated application environment; no inherited
  application secrets or copied `.env` files.
- Identical package manifest and lockfile hashes, measuring source/route removal only.

The shared package manifest SHA256 was
`94d578a1740db8869f2a8463b52cf57e9347a43d90e1eebda4b70e15d97c3ef0`.
The shared lockfile SHA256 was
`56aad3952d76f2c672f0f400899f1fbc8cb78f14583fe4537de54b792c3cf238`.
Sibling contract/common/telemetry sources and dependency installations were held fixed
between measurements. This comparison intentionally excludes dependency removal or
installation time.

## Results

| Metric                        |      Before |       After |                Observed difference |
| ----------------------------- | ----------: | ----------: | ---------------------------------: |
| Full build wall time          |    91.897 s |    92.133 s |                           +0.236 s |
| Next reported compilation     |      48.0 s |      44.0 s |                             -4.0 s |
| Next reported TypeScript      |      37.7 s |      43.0 s |                             +5.3 s |
| Static + dynamic route count  |         154 |         148 |                                 -6 |
| Logical emitted `.next` bytes | 893,467,339 | 880,080,662 | -13,386,677 (about 13.4 MB; 1.50%) |

Both measured builds completed successfully. These are one successful measurement per
snapshot; no repeated-run confidence interval or overall compile-speed improvement is
claimed. Next phase times come from its reported build output and have its reporting
precision. The total time increased by 0.236 seconds in this observation.

Logical emitted bytes sum regular `.next` files, excluding Next cache and symlinks and
counting duplicate file copies separately. The metric excludes `public` assets and is
neither physical disk allocation nor complete Docker/registry/browser download size.
Prepared public HWP and other runtime assets were held constant during this comparison.

The initial failed snapshots involving absolute source aliases and tooling dependency
resolution are excluded. Their failure times are not baseline samples. Successful
logs, result JSON, snapshot metadata, and the measurement/runbook scripts remain in the
ignored `.artifacts/page-embed-performance/` directory.

## Delivery consequence

Web now hosts Page embed integration and external tool origins. The tool repository
owns each app's build, Node runtime, immutable release image, and Deployment. A change
to one tool can build and redeploy that server without a Web package change. Changes
to shared tool UI, server code, or dependencies can rebuild all four tools while keeping
Web delivery independent. A parent embed contract or origin change may still require a
Web update.

Production tool publishing runs only from Release Please-created release tags/commits.
Each tool's GitOps activation uses a reviewed immutable image digest. The YouTube tool
origin serves its frontend; the WWW API prefix routes directly to the YouTube mini
server so the existing host-only session cookie remains available to its authenticated
API requests.

This build comparison does not measure live redeploy duration, production resource use,
registry transfer, or browser performance. Separate native Docker build/container
observations and cache conditions are recorded in `geul-tools/docs/performance.md`.
The root also ran selected mini app builds sequentially with Node `24.21.0`, Vite
`8.3.3`, warm installed dependencies, and cold selected app `dist` output:

| Tool          | Build wall time | Vite reported time | Logical dist bytes | Files |
| ------------- | --------------: | -----------------: | -----------------: | ----: |
| Transcode     |         0.839 s |            0.651 s |          2,318,830 |     5 |
| YouTube Audio |         0.555 s |            0.417 s |          2,324,765 |     5 |
| HWP           |         0.440 s |            0.309 s |         44,317,815 |    61 |
| PortaDJ       |         0.349 s |            0.215 s |          1,275,746 |    26 |

Each timed `node scripts/build.mjs <tool>` command excludes pnpm process startup and
retains OS caches, prepared public runtime assets, and other app outputs. All commands
passed with unchanged tool manifest/lock hashes. HWP already had 43,256,523 bytes of
prepared public runtime assets. Mini dist bytes include copied public assets and
regular file duplicates, excluding symlinks.

Selected Vite bundling and the whole Web build's strict TypeScript checking/Next route
generation cover different workloads, so these measurements do not establish a speed
ratio against Web. The paired Web result still shows no overall speedup and about
13.4 MB less logical `.next` output. Mini build logs/result JSON and the combined
`root-timings.log` remain under `geul-tools/.artifacts/page-embed-builds/`.
Production `linux/amd64` image proof and live redeploy timings remain pending.
