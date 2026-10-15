import { addons } from 'storybook/manager-api';
import { create } from 'storybook/theming';
import { primitiveTokens, semanticThemes } from '../components/core/design-tokens';

// The manager is a neutral reference frame; the Theme toolbar controls the product preview.
addons.setConfig({
  theme: create({
    base: 'light',
    brandTitle: 'Geul · Design system',
    brandUrl: '/?path=/story/foundations-overview--start',
    brandTarget: '_self',
    colorPrimary: primitiveTokens.colors.neutral[900],
    colorSecondary: semanticThemes.light['action-primary'],
    appBg: semanticThemes.light.background,
    appContentBg: semanticThemes.light.surface,
    appBorderColor: semanticThemes.light['border-default'],
    appBorderRadius: 0,
  }),
  sidebar: { showRoots: true },
  layout: { showPanel: true },
});
