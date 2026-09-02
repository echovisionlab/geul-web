import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import 'katex/dist/katex.min.css';
import '../lib/styles/variables.css';
import '../lib/styles/document-content.css';
import '../lib/styles/print.css';
import '../lib/styles/font-assignment.css';
import './preview-fonts.css';

import { useLayoutEffect, type ReactNode } from 'react';
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import { MantineProvider } from '@mantine/core';
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
import { theme } from '../theme';

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

export const parameters = {
  layout: 'fullscreen',
  options: {
    layout: { showPanel: false },
    // @ts-expect-error – storybook throws build error for (a: any, b: any)
    storySort: (a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }),
  },
  backgrounds: { disable: true },
};

export const globalTypes = {
  locale: {
    name: 'Locale',
    description: 'UI locale',
    defaultValue: DEFAULT_LOCALE,
    toolbar: {
      icon: 'globe',
      items: getSupportedLocaleOptions(),
      dynamicTitle: true,
    },
  },
  theme: {
    name: 'Theme',
    description: 'Mantine color scheme',
    defaultValue: 'light',
    toolbar: {
      icon: 'mirror',
      items: [
        { value: 'light', title: 'Light' },
        { value: 'dark', title: 'Dark' },
      ],
    },
  },
};

export const decorators = [
  (renderStory: any, context: any) => {
    const scheme = (context.globals.theme || 'light') as 'light' | 'dark';
    const locale = normalizeLocale(context.globals.locale) ?? DEFAULT_LOCALE;

    return (
      <NextIntlClientProvider locale={locale} messages={localeMessages[locale]}>
        <StorybookLocaleDocument locale={locale}>
          <MantineProvider theme={theme} forceColorScheme={scheme}>
            {renderStory()}
          </MantineProvider>
        </StorybookLocaleDocument>
      </NextIntlClientProvider>
    );
  },
];
