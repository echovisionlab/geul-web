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

Production after-results will be added following deployment of the validated
release. Initial-response legal body, layout stability, actual initial JS/CSS
transfer, map ready time and navigation/locale errors are checked at that boundary.
