import type { ClientMessages } from './client-messages';
import type { SupportedLocale } from './locale';

type ClientMessagesLoader = () => Promise<ClientMessages>;

const CLIENT_MESSAGE_LOADERS: Record<SupportedLocale, ClientMessagesLoader> = {
  en: async () => (await import('@/messages/en.json')).default,
  ko: async () => (await import('@/messages/ko.json')).default,
  ja: async () => (await import('@/messages/ja.json')).default,
  'zh-CN': async () => (await import('@/messages/zh-CN.json')).default,
  'zh-TW': async () => (await import('@/messages/zh-TW.json')).default,
  es: async () => (await import('@/messages/es.json')).default,
  'es-419': async () => (await import('@/messages/es-419.json')).default,
  fr: async () => (await import('@/messages/fr.json')).default,
  de: async () => (await import('@/messages/de.json')).default,
  'pt-BR': async () => (await import('@/messages/pt-BR.json')).default,
  'pt-PT': async () => (await import('@/messages/pt-PT.json')).default,
  it: async () => (await import('@/messages/it.json')).default,
  nl: async () => (await import('@/messages/nl.json')).default,
  ar: async () => (await import('@/messages/ar.json')).default,
  id: async () => (await import('@/messages/id.json')).default,
  vi: async () => (await import('@/messages/vi.json')).default,
  th: async () => (await import('@/messages/th.json')).default,
  tr: async () => (await import('@/messages/tr.json')).default,
  pl: async () => (await import('@/messages/pl.json')).default,
  ru: async () => (await import('@/messages/ru.json')).default,
};

export function loadClientMessagesForLocale(locale: SupportedLocale): Promise<ClientMessages> {
  return CLIENT_MESSAGE_LOADERS[locale]();
}
