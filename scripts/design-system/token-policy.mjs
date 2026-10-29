/** Policy shared by the CLI and editor lint rule. Paths are repository relative. */
export const sourceRoots = ['app', 'components', 'features', 'lib'];
export const tokenDefinitionFiles = new Set(['components/core/design-tokens.ts', 'lib/styles/design-tokens.css']);
/** The shared locale assignment owns these two font roles only. */
export const fontDefinitionFiles = new Set(['lib/styles/font-assignment.css']);
export const fontRoles = new Set(['--font-family-sans', '--font-mono']);
/** The branding adapter projects validated site configuration into the brand fill and its text color. */
export const runtimeRoleOwners = new Map([['lib/theme/site-brand.ts', new Set(['--geul-brand-color', '--geul-brand-ink'])]]);

export const legacyDefinitionFiles = new Set(['lib/styles/variables.css']);
/** Type sizes that belong to generated or authored artwork rather than interface roles. Screen and
 * paper interface text (including print.css) consumes the shared type roles; keep this list narrow. */
export const authoredTypographyFiles = new Map([
  ['lib/utils/og-config.ts', 'Generated share-image artwork defaults (pixel geometry rendered by Satori)'],
  ['lib/utils/og-image.tsx', 'Generated share-image artwork (pixel geometry from site settings)'],
  [
    'features/page/blocks/immersive-scene/SceneRenderer.tsx',
    'Viewport-scaled immersive scene title artwork (clamp/vw geometry of the authored scene)',
  ],
  [
    'features/application-error/ErrorCodeParticles.tsx',
    'Canvas glyph mask sampled into the error-code particle artwork',
  ],
]);
// Inline style geometry that belongs to authored artwork rather than product spacing relationships.
// Keep this narrow; product chrome inside these files still uses Core components and tokens.
export const authoredGeometryFiles = new Map([
  [
    'features/page/blocks/immersive-scene/SceneRenderer.tsx',
    'Viewport-scaled immersive scene presentation (clamp/vw geometry of the authored scene)',
  ],
]);

// These literals are authored data or third-party identities, not interface colors.
// Keep exceptions narrow and review any additions alongside the audit document.
export const authoredColorFiles = new Map([
  ['components/core/Social/brand-colors.ts', 'Third-party identity palettes'],
  ['lib/theme/site-brand.ts', 'Configurable site branding default'],
  ['lib/types/map-theme/schema.ts', 'User-authored map theme schema defaults'],
  ['lib/types/site-setting/config.ts', 'User-authored site setting defaults'],
  ['lib/utils/og-config.ts', 'Generated share-image palette'],
  ['lib/utils/og-image.tsx', 'Generated share-image artwork'],
  ['features/page/blocks/immersive-scene/schema.ts', 'User-authored scene defaults'],
  ['features/page/blocks/immersive-scene/scene-renderer-model.ts', 'User-authored 3D artwork'],
  ['features/page/blocks/immersive-scene/settings-model.ts', 'User-authored 3D artwork defaults'],
  ['features/map/hooks/useMap3DBuildings.ts', 'Map artwork styling'],
  ['features/map/hooks/useMapLabels.ts', 'Map artwork styling'],
]);

export function isProductionSource(file) {
  return (
    /\.(?:css|tsx?)$/.test(file) &&
    !/(?:^|\/)(?:node_modules|gen|generated|vendor|storybook-static|docs|fixtures|__fixtures__|__tests__)(?:\/|$)/.test(
      file,
    ) &&
    !/\.(?:test|spec|type-test|stories|story|story-fixtures)\./.test(file) &&
    !/\.(?:d\.ts|stories\.module\.css)$/.test(file)
  );
}

// Mantine public variables are upstream token overrides, not new application tokens.
export function isPrivateOrFrameworkProperty(name) {
  return name.startsWith('--_') || name.startsWith('--mantine-');
}
