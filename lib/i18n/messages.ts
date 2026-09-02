import arMessages from '@/messages/ar.json';
import deMessages from '@/messages/de.json';
import messages from '@/messages/en.json';
import esMessages from '@/messages/es.json';
import es419Messages from '@/messages/es-419.json';
import frMessages from '@/messages/fr.json';
import idMessages from '@/messages/id.json';
import itMessages from '@/messages/it.json';
import jaMessages from '@/messages/ja.json';
import koMessages from '@/messages/ko.json';
import nlMessages from '@/messages/nl.json';
import plMessages from '@/messages/pl.json';
import ptBRMessages from '@/messages/pt-BR.json';
import ptPTMessages from '@/messages/pt-PT.json';
import ruMessages from '@/messages/ru.json';
import thMessages from '@/messages/th.json';
import trMessages from '@/messages/tr.json';
import viMessages from '@/messages/vi.json';
import zhCNMessages from '@/messages/zh-CN.json';
import zhTWMessages from '@/messages/zh-TW.json';
import { DEFAULT_LOCALE, normalizeLocale, type SupportedLocale } from './locale';

const localeMessages: Record<SupportedLocale, typeof messages> = {
  en: messages,
  ko: koMessages,
  ja: jaMessages,
  'zh-CN': zhCNMessages,
  'zh-TW': zhTWMessages,
  es: esMessages,
  'es-419': es419Messages,
  fr: frMessages,
  de: deMessages,
  'pt-BR': ptBRMessages,
  'pt-PT': ptPTMessages,
  it: itMessages,
  nl: nlMessages,
  ar: arMessages,
  id: idMessages,
  vi: viMessages,
  th: thMessages,
  tr: trMessages,
  pl: plMessages,
  ru: ruMessages,
};

export async function getMessagesForLocale(locale: string | null | undefined): Promise<typeof messages> {
  const normalizedLocale = normalizeLocale(locale) ?? DEFAULT_LOCALE;
  return localeMessages[normalizedLocale];
}
