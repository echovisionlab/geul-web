# Public loading performance

Comparison scope: homepage, `/works`, `/tools`, `/tools/transcode`, `/privacy`,
`/terms`. Initial deployment baseline is Web 0.2.5. Measurements use the same
anonymous in-app Chromium 154 session, English, rejected non-essential cookies,
1280×720 viewport, DPR 1, cache disabled, no CPU/network throttle, three reloads
per route and 10 seconds of observation. CDN/connection/server conditions are not
reset. Report medians; these desktop lab observations are not mobile or field p75
Core Web Vitals, and no INP result is claimed.

Map ready is sampled every 25ms when the canvas is visible and the controller's
absolute loading overlay (z-index 20) has disappeared. It is not a GPU frame-time
measurement. CLS uses the maximum session window, excluding recent-input shifts.

## Controlled local results

- English compact translation JSON: 152,746 → 58,915 bytes (−61.4%).
- Korean compact translation JSON: 177,666 → 68,450 bytes (−61.5%).
- Full server catalogues are retained; only the transmitted anonymous catalogue
  is smaller. These are JSON payload bytes, not compressed HTTP transfer bytes.
- Public metadata and body: identical homepage/Page Get calls 2 → 1 per React
  request. Source-locale fallback path 3 → 2. Controlled request-memoization tests
  cover locale isolation, absent Pages and transient errors.
- Policy/terms SSR fixture: initial published paragraph 0 → 1; initial browser
  RPC calls 2 → 0. The real renderer and hydration tests preserve document DOM.
- Map loader fixture: 0 imports for an unused empty map; 1 needed runtime import
  while the theme is unresolved, still 1 after it resolves.
- Nine editor implementations no longer have static route imports. Generated
  and legacy heavy rich-text dependencies have client-owned dynamic boundaries.
  No bundle-size claim is inferred from source import counts.

## Deployment comparison

Web 0.2.6 was deployed with the validated image digest
`sha256:36da088e46e28d99f4099e5136ed141e03610a9de0b2fc6401eac42ea8c06f11`.
The same-session three-trial medians are:

| Route              |  Initial script transfer bytes |      LCP ms |                 CLS |
| ------------------ | -----------------------------: | ----------: | ------------------: |
| `/`                |   1,154,997 → 824,637 (-28.6%) |   620 → 576 | 0.000358 → 0.000000 |
| `/works`           | 2,107,515 → 1,109,847 (-47.3%) |  1140 → 876 | 0.002264 → 0.002264 |
| `/tools`           |   1,822,820 → 825,117 (-54.7%) |   556 → 664 | 0.000000 → 0.000000 |
| `/tools/transcode` |      667,476 → 671,856 (+0.7%) |   604 → 556 | 0.000000 → 0.000000 |
| `/privacy`         |     987,793 → 659,394 (-33.2%) | 1652 → 1004 | 0.237936 → 0.000000 |
| `/terms`           |     987,783 → 659,386 (-33.2%) | 1464 → 1032 | 0.237936 → 0.000000 |

The homepage currently contains no published content blocks; its LCP is therefore
not a measure of content-rich homepage rendering. Transcode adds about 4.4KB of
initial scripts for the navigation catalogue boundary. Tools LCP increased in this
small sample despite a large script reduction. Timing observations include live
server/network and font variation; they do not establish statistical significance.
Browser console warnings/errors were absent across these measured reloads.

Map-ready median was 2,157 → 2,591ms, so 0.2.6 did not demonstrate faster map
readiness. The worker still loaded its shared module in a serial request. The
follow-up bundles that static dependency into the existing same-origin ESM worker
asset, preserving variable plugin imports, license and runtime lifecycle. In the
same installed MapLibre 6.4.0 source graph, assets decrease 2 → 1, decoded bytes
500,628 → 471,020 (−5.9%) and gzip level-9 bytes 139,486 → 131,741 (−5.6%).
This controlled byte/request result is separate from deployed map-ready timing.
The generation test verifies the complete input graph, no output static imports,
runtime plugin imports and identical license bytes. Final deployed runtime
measurements are recorded in the operator comparison artifact.
