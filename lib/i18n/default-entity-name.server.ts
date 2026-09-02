import 'server-only';

import { getMessagesForLocale } from '@/lib/i18n/messages';
import { getUserLocale } from '@/lib/utils/language.server';

type NewEntityKey = 'artist' | 'label';

export async function getLocalizedNewEntityName(entityKey: NewEntityKey): Promise<string> {
  const locale = await getUserLocale();
  const messages = await getMessagesForLocale(locale);
  const item = messages.common.entities[entityKey];

  return messages.common.actions.newItem.replace('{item}', item);
}
