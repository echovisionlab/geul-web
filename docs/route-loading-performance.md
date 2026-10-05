# Route loading boundary measurements

The baseline is Web v0.4.1, commit `9d77255`. This investigation distinguishes
actual Firefox requests, rendered RSC module references, and the larger client
reference manifest. A manifest's reachable chunks are not the initial download.

## Observed production baseline

The root investigator measured the signed-in production homepage in Firefox:
45 JavaScript requests, 826,720 transferred bytes, and 2,667,810 decoded bytes.
All 77 requests transferred approximately 1.07 MB. The visible home had no
body sections and displayed site information/footer content. These observations
describe that session and route; they are not anonymous-route or cold-build
measurements.

Three subsequent hard reloads used the same signed-in Firefox profile, locale,
viewport, uBlock settings, and unthrottled network. The Network list was cleared
between runs and the disable-cache checkbox was off; these are not certified
empty-cache runs. All three still requested 45 JS files:

| Run | DOMContentLoaded seconds | Load seconds |  All requests decoded | All requests transferred |
| --- | -----------------------: | -----------: | --------------------: | -----------------------: |
| 1   |                     2.10 |         2.59 | approximately 3.47 MB |    approximately 1.06 MB |
| 2   |                     1.54 |         1.69 | approximately 3.43 MB |    approximately 1.03 MB |
| 3   |                     4.23 |         4.47 | approximately 3.43 MB |    approximately 1.02 MB |

The earlier 26.91-second observation is an outlier, not the representative
baseline. These reloads measure the existing production version; they are not
post-change measurements or evidence of a latency improvement.

Public payload inspection of the exact requested JavaScript established:

| Asset basename     | Decoded bytes | Confirmed payload                                                                    |
| ------------------ | ------------: | ------------------------------------------------------------------------------------ |
| `4037bbc2y770x.js` |       283,459 | Zod API exports                                                                      |
| `36iv5da456k9b.js` |       205,764 | Connect/protobuf and public/secure client factories, including admin/email/menu/page |
| `0e9g432icblru.js` |       199,781 | FormRenderer, buildForm, phone metadata/country list                                 |
| `1955luve95crj.js` |       196,857 | Mixed Form, immersive scene, maps, and list client views                             |
| `06vhcz818zh3_.js` |       123,731 | Input, PhoneInputView, Mantine Combobox                                              |
| `3iqszd96idyfc.js` |       204,606 | React DOM/Scheduler                                                                  |
| `24hv5pcp6rct2.js` |       129,223 | Next routing/RSC/server-action runtime                                               |

The mixed chunks contain useful shared code as well as unused optional
implementations; their entire sizes are not a claim of removable bytes. React
DOM and Next runtime are not the proposed removal targets.

Home-to-Works navigation measured 32 requests and approximately 4.99 MB.
Eight OpenFreeMap zoom-2 vector tiles accounted for 4,443,850 bytes, approximately
89% of that transfer. MapLibre JS transferred 254,100 bytes and decoded to
975,620 bytes; its worker transferred 133,330 bytes and decoded to 471,020
bytes. The map occupied the initial viewport, so this observation does
not justify calling it an offscreen map or deferring visible map rendering.
Viewport/zoom/tile-request changes require a matching viewport and coverage
comparison; tile count alone cannot establish preserved map behavior.

## Repeatable compiled artifact inspection

Use Node 24.19.0, pnpm 11.22.0, Next 16.3.1, the same frozen lockfile, and
secret-free baseline/final worktrees. The root coordinates the fresh full
application builds; this inspection command does not build, install, start a
server, or modify the source/output tree.

```sh
node scripts/performance/route-client-assets.mjs /tmp/geul-before '(general)/page'
node scripts/performance/route-client-assets.mjs /tmp/geul-after '(general)/page'
node scripts/performance/route-client-assets.mjs /tmp/geul-after '(general)/works/page'
```

For an actual response, optionally pass a sanitized rendered RSC body or a
one-asset-URL-per-line list captured from that exact build:

```sh
node scripts/performance/route-client-assets.mjs /tmp/geul-after '(general)/page' --rsc /tmp/home-rendered.rsc --requested-assets /tmp/home-assets.txt
```

Do not supply a HAR, request headers, cookies, or authentication data. If a
browser capture uses a different build's hashed filenames, inspect its public
payloads separately rather than treating them as assets of the local build.

The report records build ID, lockfile hash, manifest timestamp, per-file SHA256,
raw/gzip level-9 bytes, focused client-module asset membership, and literal
markers for form, phone, admin factories, scene, map, and search runtime.
Marker absence is evidence about these compiled payloads, not a full test of
behavior or runtime execution. Gzip fixture/artifact bytes are not the CDN's
observed compressed transfer or HTTP overhead.

- `manifestPotential`: all assets listed by the route's client-module manifest;
  includes unused optional references and is not initial loading.
- `renderedRscReferences`: assets named in rendered RSC import records; excludes
  additional framework bootstrap and subsequent dynamic requests.
- `browserRequested`: the supplied actual Next static/chunks JS/CSS request set,
  inspected against the same build's artifacts. Fonts, tiles, external workers,
  and API requests are excluded. Browser timing/transfer requires the browser's own
  measurements.

For the home, inspect whether FormRenderer/phone/admin factories remain in the
actual request set. For content containing form, map, or scene, inspect both
initial references and the chunks loaded when that feature renders. Optional
boundaries retain SSR, so a rendered feature can legitimately preload its
runtime. Merely hiding a component with CSS is not a loading boundary.

## Verification scope

Fresh baseline and changed-source default Next 16.3.1 production builds both
passed using Node 24.19.0, pnpm 11.22.0, the frozen lockfile, and the secret-free
build wrapper. The home route's **manifest potential set** changed as follows:

| Compiled manifest metric           |    Before |     After |
| ---------------------------------- | --------: | --------: |
| Listed JS/CSS files                |        38 |        35 |
| Raw bytes                          | 2,226,132 | 1,592,559 |
| Sum of per-file gzip level-9 bytes |   648,774 |   476,442 |

The potential set decreases by 633,573 raw bytes and 172,332 gzip bytes. This is
an upper-bound artifact comparison, not a measured initial transfer reduction.
FormRenderer, admin-factory, and immersive-runtime markers are absent from the
after potential set. The inspected after assets also lack the quoted phone
export markers `AsYouType` and `PHONE_COUNTRIES`. An earlier bare
`libphonenumber-js` match in `169igm78rnd4j.js` came from package dependency
metadata imported by `lib/site-version.ts`, not phone runtime code. The harness
now uses only those quoted phone export markers. Marker absence remains a
payload check, not proof of every possible runtime execution path.

Evidence files are `/tmp/dsub-route-before-assets.json` and
`/tmp/dsub-route-after-assets.json`. Build IDs are baseline
`qj8fnpNMUBne_npAZ__uc` and changed-source `a-O5shLEP6-bB1W6MOaKI`.
Both lockfile SHA256s are
`a7603ae2b3532129d5a3b4cee6da0e6c8dffeb9ffca52eca1430202edd0ea3c8`.
The after snapshot includes implementation changes; it is not evidence of a
deployed production release. Actual after browser-request and timing results
have not been measured here.

After/before asset counts, encoded bytes, and main-thread timings must come
from fresh comparable evidence; no percentage gain is inferred from module
counts. Compare identical session, locale, content, viewport, cache state, and
browser/network settings. Test form validation/submission, search shortcut,
visible maps, immersive playback, and map printing separately from payload
membership. No cold-build speed comparison is justified during parallel tests.

The API actor's controlled page-query mock reports two calls before and one
after. Separate session tests cover SSR session data and explicit SSR null,
and simultaneous focus/visible refresh calls decrease from two to one; the
focused session suite passed 35 tests. These verify deduplication and session
behavior at their test boundaries; they are not measured production TTFB or
user latency improvements.
