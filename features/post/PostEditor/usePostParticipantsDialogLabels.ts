'use client';

import { useTranslations } from 'next-intl';
import type { PostParticipantsDialogViewProps } from './ui/PostParticipantsDialogView';

export function usePostParticipantsDialogLabels(): PostParticipantsDialogViewProps['labels'] {
  const t = useTranslations('postParticipants');
  const tActions = useTranslations('common.actions');
  const tMessages = useTranslations('common.messages');
  const tPlaceholders = useTranslations('common.placeholders');

  return {
    title: t('title'),
    close: tActions('close'),
    addSectionLabel: t('addSectionLabel'),
    memberLabel: t('memberLabel'),
    searchPlaceholder: tPlaceholders('searchByName'),
    typeAtLeast2Characters: tMessages('typeAtLeast2Characters'),
    noUsersFound: tMessages('noUsersFound'),
    roleLabel: t('roleLabel'),
    author: t('roles.author'),
    collaborator: t('roles.collaborator'),
    empty: t('empty'),
    inactiveAuthority: t('inactiveAuthority'),
    lastAuthor: t('lastAuthor'),
    removeAuthor: t('removeAuthor'),
    adminOnlyRemoveAuthor: t('adminOnlyRemoveAuthor'),
    removeCollaborator: t('removeCollaborator'),
    cannotRemoveCollaborator: t('cannotRemoveCollaborator'),
    changeToAuthor: t('changeToAuthor'),
    changeToCollaborator: t('changeToCollaborator'),
    cannotChangeRole: t('cannotChangeRole'),
    inactiveCannotChangeRole: t('inactiveCannotChangeRole'),
  };
}
