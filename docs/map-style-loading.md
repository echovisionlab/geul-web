# Map style readiness

MapLibre keeps its normal style diff enabled. The runtime keeps the initial `mapStyle` prop stable and a small controller applies the latest requested theme or style only once `isStyleLoaded()` is true. `style.load` can precede source readiness, so `idle` is also checked. Requests during loading coalesce; unmount removes both listeners.

## Before and after measurement

Measured on 2026-10-01 with installed react-map-gl 8.1.2 and MapLibre 6.4.0. The deterministic test uses the same five replacements and readiness transitions for the former direct-prop path and the controller: two before initial readiness, two during a replacement, and one after readiness.

| Count                               | Before | After |
| ----------------------------------- | -----: | ----: |
| Requested replacements              |      5 |     5 |
| Calls to `setStyle`                 |      5 |     3 |
| Modeled diff failures while loading |      3 |     0 |
| Modeled fallback style rebuilds     |      3 |     0 |
| Modeled `warnOnce` emissions        |      1 |     0 |

Style calls decrease 40%, and the final requested style is preserved. The loading-time fallback follows the installed MapLibre implementation: `Style.setState` throws while unloaded, and the map catches the failure, logs once, and rebuilds its style. The test records the observed harness calls; it does not hard-code successful counts for the controller.

These are controlled lifecycle counts, not measured browser latency, CPU time, or network traffic. The production warning is timing-dependent and did not reproduce in the fresh pre-release Works tab, so a live warning reduction cannot be claimed from that navigation. The production check verifies rendering, theme changes, and console behavior separately.

Reproduce with `pnpm exec vitest run features/map/utils/map-style-controller.test.ts features/map/MapLibreMap.test.tsx`.
