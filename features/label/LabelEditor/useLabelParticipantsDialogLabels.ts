'use client';

import { useTranslations } from 'next-intl';
import type { LabelParticipantsDialogViewProps } from './ui/LabelParticipantsDialogView';

export function useLabelParticipantsDialogLabels(): LabelParticipantsDialogViewProps['labels'] {
  const t = useTranslations('artistManagers');
  const tActions = useTranslations('common.actions');
  const tEntities = useTranslations('common.entities');
  const tMessages = useTranslations('common.messages');
  const tPlaceholders = useTranslations('common.placeholders');
  return {
    title: t('title'),
    close: tActions('close'),
    addParticipant: tActions('add'),
    member: tEntities('member'),
    role: t('role'),
    owner: t('owner'),
    manager: t('manager'),
    inactive: t('inactive'),
    makeOwner: t('makeOwner'),
    makeManager: t('makeManager'),
    remove: t('remove'),
    empty: t('empty'),
    lastOwner: t('lastOwner'),
    searchPlaceholder: tPlaceholders('searchByEmailOrName'),
    typeAtLeast2Characters: tMessages('typeAtLeast2Characters'),
    noUsersFound: tMessages('noUsersFound'),
  };
}
