import './runtime-config-fixture';
import '../lib/styles/base.css';
import 'katex/dist/katex.min.css';
import '../lib/styles/variables.css';
import '../lib/styles/document-content.css';
import '../lib/styles/print.css';
import '../lib/styles/font-assignment.css';
import './preview-fonts.css';

import { useEffect, useLayoutEffect, useState, type ReactNode, type PropsWithChildren } from 'react';
import { DocsContainer, type DocsContainerProps } from '@storybook/addon-docs/blocks';
import { GLOBALS_UPDATED } from 'storybook/internal/core-events';
import { create, themes } from 'storybook/theming';
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import { DesignSystemProvider } from '../lib/providers/DesignSystemProvider';
import {
  getThemeDefinition,
  getThemeTokens,
  normalizeThemeId,
  themeDefinitions,
  type ThemeId,
} from '../lib/theme/themes';
import { AuthoringExtensionsProvider } from '../features/authoring/AuthoringExtensionsContext';
import arMessages from '../messages/ar.json';
import deMessages from '../messages/de.json';
import enMessages from '../messages/en.json';
import es419Messages from '../messages/es-419.json';
import esMessages from '../messages/es.json';
import frMessages from '../messages/fr.json';
import idMessages from '../messages/id.json';
import itMessages from '../messages/it.json';
import jaMessages from '../messages/ja.json';
import koMessages from '../messages/ko.json';
import nlMessages from '../messages/nl.json';
import plMessages from '../messages/pl.json';
import ptBRMessages from '../messages/pt-BR.json';
import ptPTMessages from '../messages/pt-PT.json';
import ruMessages from '../messages/ru.json';
import thMessages from '../messages/th.json';
import trMessages from '../messages/tr.json';
import viMessages from '../messages/vi.json';
import zhCNMessages from '../messages/zh-CN.json';
import zhTWMessages from '../messages/zh-TW.json';
import {
  DEFAULT_LOCALE,
  getLocaleDirection,
  getLocaleFontProfile,
  getSupportedLocaleOptions,
  normalizeLocale,
  type SupportedLocale,
} from '../lib/i18n/locale';
import { LocaleProvider } from '../lib/providers/LocaleProvider';
import { RequestTimeZoneProvider } from '../lib/providers/RequestTimeZoneProvider';
import { StoryCanvas } from './StoryCanvas';
import { preloadOnDemandOverlays } from '../components/core/on-demand-overlays';
import { PreviewNavigation } from './PreviewNavigation';
import { localizeFixtureArgs, useStorybookText } from './fixture-i18n';
import { DesignSystemDocs } from './DesignSystemDocs';
import { enhanceCoreArgTypes } from './documentation-contract';

const localeMessages = {
  ar: arMessages,
  de: deMessages,
  en: enMessages,
  es: esMessages,
  'es-419': es419Messages,
  fr: frMessages,
  id: idMessages,
  it: itMessages,
  ja: jaMessages,
  ko: koMessages,
  nl: nlMessages,
  pl: plMessages,
  'pt-BR': ptBRMessages,
  'pt-PT': ptPTMessages,
  ru: ruMessages,
  th: thMessages,
  tr: trMessages,
  vi: viMessages,
  'zh-CN': zhCNMessages,
  'zh-TW': zhTWMessages,
} satisfies Record<SupportedLocale, AbstractIntlMessages>;

function LocalizedStory({ renderStory, context }: { renderStory: any; context: any }) {
  const text = useStorybookText();
  const args = localizeFixtureArgs(context.args, text);
  if ('locale' in args) {
    args.locale = normalizeLocale(context.globals.locale) ?? DEFAULT_LOCALE;
  }
  return renderStory({ args });
}

function StorybookLocaleDocument({ locale, children }: { locale: SupportedLocale; children: ReactNode }) {
  const direction = getLocaleDirection(locale);
  const fontProfile = getLocaleFontProfile(locale);

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.lang = locale;
    root.dir = direction;
    root.dataset.fontProfile = fontProfile;
  }, [direction, fontProfile, locale]);

  return (
    <div lang={locale} dir={direction} data-font-profile={fontProfile}>
      {children}
    </div>
  );
}

function StorybookEnvironment({
  locale,
  themeId,
  children,
}: {
  locale: SupportedLocale;
  themeId: ThemeId;
  children: ReactNode;
}) {
  return (
    <NextIntlClientProvider locale={locale} messages={localeMessages[locale]} timeZone="UTC">
      <LocaleProvider locale={locale}>
        <RequestTimeZoneProvider timeZone="UTC">
          <StorybookLocaleDocument locale={locale}>
            <DesignSystemProvider locale={locale} forceTheme={themeId}>
              {children}
            </DesignSystemProvider>
          </StorybookLocaleDocument>
        </RequestTimeZoneProvider>
      </LocaleProvider>
    </NextIntlClientProvider>
  );
}

/** Documentation and embedded previews consume the same global theme and locale. */
function StorybookDocsContainer({ context, children }: PropsWithChildren<DocsContainerProps>) {
  const firstStory = context.componentStories()[0];
  const [globalValues, setGlobalValues] = useState<Record<string, unknown>>(() =>
    firstStory ? context.getStoryContext(firstStory).globals : initialGlobals,
  );
  useEffect(() => {
    const receive = (event: { globals: Record<string, unknown> }) => setGlobalValues(event.globals);
    context.channel.on(GLOBALS_UPDATED, receive);
    return () => {
      context.channel.off(GLOBALS_UPDATED, receive);
    };
  }, [context]);
  const selectedTheme = getThemeDefinition(globalValues.theme);
  const tokens = getThemeTokens(selectedTheme.id);
  const locale =
    normalizeLocale(typeof globalValues.locale === 'string' ? globalValues.locale : undefined) ?? DEFAULT_LOCALE;
  return (
    <StorybookEnvironment locale={locale} themeId={selectedTheme.id}>
      <DocsContainer
        context={context}
        theme={create({
          ...themes[selectedTheme.base],
          colorPrimary: tokens['action-primary'],
          colorSecondary: tokens['action-accent'],
          appBg: tokens.background,
          appContentBg: tokens.surface,
          appPreviewBg: tokens.background,
          appBorderColor: tokens['border-default'],
          textColor: tokens['text-primary'],
          textMutedColor: tokens['text-muted'],
          barBg: tokens.surface,
          barTextColor: tokens['text-secondary'],
          barSelectedColor: tokens['action-primary'],
          inputBg: tokens.surface,
          inputTextColor: tokens['text-primary'],
          inputBorder: tokens['border-default'],
          appBorderRadius: 0,
          inputBorderRadius: 0,
          fontBase: 'var(--font-family-sans), sans-serif',
          fontCode: 'var(--font-mono), monospace',
        })}
      >
        {children}
      </DocsContainer>
    </StorybookEnvironment>
  );
}

export const tags = ['autodocs'];
export const argTypesEnhancers = [enhanceCoreArgTypes];

export const parameters: import('@storybook/nextjs').Preview['parameters'] & {
  options: {
    [key: string]: unknown;
    storySort: (
      a: import('storybook/internal/types').IndexEntry,
      b: import('storybook/internal/types').IndexEntry,
    ) => number;
  };
} = {
  layout: 'fullscreen',
  docs: {
    page: DesignSystemDocs,
    container: StorybookDocsContainer,
    toc: { headingSelector: 'h2, h3', ignoreSelector: '.docs-story *', title: 'Contents' },
    story: { inline: true },
    // Localized render functions carry React/provider metadata. Use the actual CSF
    // source instead of serializing those runtime objects into generated JSX.
    source: { type: 'code' },
  },
  a11y: {
    // Include portals (dialogs and menus) outside the story root.
    context: 'body',
    options: {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'],
      },
    },
    test: 'error',
  },
  options: {
    layout: { showPanel: true },
    // Storybook evaluates this callback independently when building the index.
    // Keep its values/helpers inside the function and its syntax plain JavaScript.
    storySort: (a, b) => {
      if (a.title === b.title) {
        if (!a.title.startsWith('Core/')) {
          return 0;
        }
        const priorityA =
          a.type === 'docs' ? 0 : a.id.endsWith('--default') ? 1 : a.id.endsWith('--playground') ? 2 : 3;
        const priorityB =
          b.type === 'docs' ? 0 : b.id.endsWith('--default') ? 1 : b.id.endsWith('--playground') ? 2 : 3;
        // Equal priorities retain the CSF export order through stable sorting.
        return priorityA - priorityB;
      }
      let order = [
        'Design System',
        ['Handbook', 'Components', 'Usage Rules', 'Patterns', 'Pages'],
        'Foundations',
        [
          'Overview',
          'Principles',
          'Tokens',
          'Typography',
          'Spacing',
          'Iconography',
          'Size and Density',
          'Responsive',
          'Review Canvas',
          'Accessibility and Motion',
        ],
        'Core',
        [
          'Actions',
          'Input',
          'Data Display',
          'Typography',
          'Layout',
          'Navigation',
          'Interaction',
          'Overlays',
          'Feedback',
          'Media',
        ],
        'Composition',
        'Feature',
        'Pages',
      ];
      const titleA = a.title.trim().split(/\s*\/\s*/);
      const titleB = b.title.trim().split(/\s*\/\s*/);
      for (let depth = 0; titleA[depth] || titleB[depth]; depth += 1) {
        if (!titleA[depth]) {
          return -1;
        }
        if (!titleB[depth]) {
          return 1;
        }
        const nameA = titleA[depth];
        const nameB = titleB[depth];
        if (nameA !== nameB) {
          const indexA = order.indexOf(nameA);
          const indexB = order.indexOf(nameB);
          if (indexA !== -1 || indexB !== -1) {
            return (indexA === -1 ? order.length : indexA) - (indexB === -1 ? order.length : indexB);
          }
          return nameA.localeCompare(nameB, 'en', { numeric: true, sensitivity: 'accent' });
        }
        const index = order.indexOf(nameA);
        const nestedOrder = order[index + 1];
        order = index !== -1 && Array.isArray(nestedOrder) ? nestedOrder : [];
      }
      return 0;
    },
  },
  backgrounds: { disable: true },
  viewport: {
    options: {
      phoneSmall: { name: 'Phone · 320', styles: { width: '320px', height: '640px' }, type: 'mobile' },
      phone: { name: 'Phone · 390', styles: { width: '390px', height: '844px' }, type: 'mobile' },
      tablet: { name: 'Tablet · 834', styles: { width: '834px', height: '1112px' }, type: 'tablet' },
      desktop: { name: 'Desktop · 1440', styles: { width: '1440px', height: '900px' }, type: 'desktop' },
    },
  },
};

export const globalTypes = {
  locale: {
    name: 'Language',
    description: 'Language of the actual component and page previews',
    defaultValue: 'en',
    toolbar: {
      icon: 'globe',
      items: getSupportedLocaleOptions().map(({ value, label }) => ({ value, title: label })),
      dynamicTitle: true,
    },
  },
  theme: {
    name: 'Theme',
    description: 'Shared semantic theme, including custom presets',
    defaultValue: 'light',
    toolbar: {
      icon: 'mirror',
      items: themeDefinitions.map((definition) => ({ value: definition.id, title: definition.label })),
      dynamicTitle: true,
    },
  },
};

export const initialGlobals = { locale: 'en', theme: 'light' };

// On-demand Core overlays (site chrome menus, tooltips, drawers, confirmation and notification hosts)
// load before every story so previews, play functions and visual checks render them synchronously.
export const loaders = [
  async () => {
    await preloadOnDemandOverlays();
    return {};
  },
];

export const decorators = [
  (renderStory: any, context: any) => {
    const themeId = normalizeThemeId(context.globals.theme);
    const locale = normalizeLocale(context.globals.locale) ?? DEFAULT_LOCALE;

    return (
      <StorybookEnvironment locale={locale} themeId={themeId}>
        <StoryCanvas
          title={context.title}
          name={context.name}
          embedded={context.viewMode === 'docs'}
          inset={
            context.parameters.canvasInset ??
            (context.title.startsWith('Design System/') ||
            context.title.startsWith('Foundations/') ||
            context.title.startsWith('Pages/')
              ? 'none'
              : 'lg')
          }
        >
          <PreviewNavigation appDirectory={context.parameters.nextjs?.appDirectory === true}>
            <AuthoringExtensionsProvider
              available={{
                sharing: false,
                translations: false,
                relations: false,
                uploads: false,
                generation: false,
              }}
            >
              <LocalizedStory renderStory={renderStory} context={context} />
            </AuthoringExtensionsProvider>
          </PreviewNavigation>
        </StoryCanvas>
      </StorybookEnvironment>
    );
  },
];
