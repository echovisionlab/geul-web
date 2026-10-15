# Public page motion

The public Marquee and Immersive renderers own playback behavior for their page blocks.
They consume existing Core Button, Disclosure, Layout and Typography contracts.
No new theme, spacing or control tokens are introduced.

## Marquee

Owner: [MarqueeView](../../features/page/blocks/marquee/MarqueeView.tsx).
Consumers: text-marquee, client-marquee and label-marquee public views and editor previews.
Review: `Feature / Page / Motion / Marquee` (`feature-page-motion--marquee`).

- Pause is a persistent user action. Moving focus or the pointer away does not resume playback.
- Paused and reduced-motion views show every currently resolved item once in a wrapping static group.
- The moving lane stays mounted and pauses while the static group is visible; an explicit resume retains its animation position.
- Measured and repeated visual copies remain hidden from reading and inert. The static group becomes the only semantic copy while paused.
- Hover and focus stopping supplement the explicit control. They do not replace it.

The resolved items retain their authored names, selected theme logos, destinations, target policy and missing-logo policy.
This view does not retrieve omitted items or verify external destinations.

## Immersive scene

Owner: [SceneRenderer](../../features/page/blocks/immersive-scene/SceneRenderer.tsx).
Consumer: the actual public ImmersiveSceneView, plus the editor canvas and workspace previews.
Review: `feature-page-motion--immersive-autoplay` and `feature-page-motion--immersive-scroll`.

- Pause stops the owned autoplay clock, frame loop, automatic rotation and pointer repulsion.
- Resume retains elapsed playback time, the current unit and accumulated rotation; time spent paused is not replayed as a jump.
- Read all scene information opens a static list of every authored title, description and attribution, including its existing links. Opening that list also pauses playback; closing it does not resume playback.
- With reduced motion, automatic playback stays stopped, the complete information list opens by default, and public scroll scenes use their intrinsic height.
- When the complete list is open, animated overlay copies are hidden from reading and inert to avoid duplicate semantics.
- Constrained editor previews retain the same complete-information path inside Core ScrollArea, which provides a named keyboard scroll region.

Titles, Markdown descriptions and attribution remain authored content. The list does not invent a description for a mesh or texture.
The canvas remains decorative in the accessibility tree. If a 3D asset conveys information beyond the authored copy,
its author must provide an equivalent explanation in that content. The renderer cannot establish equivalence from an asset name.

## Compatibility and review

The serialized shape, public props and consumer calls remain unchanged.
Public page UI gains visible localized motion controls and a complete-information path.
The three `common.motion` messages are present in all 20 locale bundles; existing messages are preserved.
Reduced-motion views no longer depend on movement to reveal later authored information.

The light scene background default now uses the existing invariant `paper-background` token,
matching theme-derived `paper-ink` and `paper-secondary` copy. The dark default remains unchanged.
This affects new blocks and configurations that omit `backgroundColor`; an omitted value now resolves to the paper surface.
Explicitly stored background and text colors are preserved. No migration rewrites authored colors, and no new tokens are added.
The public fixtures exercise these actual defaults without background overrides.
Regression checks resolve the current CSS roles for all four theme presets, composite inverse text alpha against the default dark background,
and require at least 4.5:1 for both title and body. Authored custom colors and 3D textures require their own review.

The selected Vitest run passed 182 renderer and message checks, including GPU/CDN-adapted runtime tests for pause,
resume, pointer effects, complete authored content and reduced-motion behavior.
GPU adapters in those tests do not verify actual WebGL rendering. The public Storybook examples use the production
runtime and its existing fallback with local authored fixture content.
Review them at mobile, tablet and desktop widths, with browser motion preference, keyboard navigation, theme and locale.
Fresh browser/axe and assistive technology review remain separate from these unit results.
External map clusters, audio/video transcripts, backend destinations and asset-level visual alternatives are outside this change.

Reference: [WCAG 2.2.2 Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html).
