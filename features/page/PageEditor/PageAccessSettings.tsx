'use client';
import { PageLoader } from '@/features/site/PageLoader';
import { SupportingText, Text as DsText } from '@/components/core/Typography';

import { LayoutStack as DsLayoutStack, LayoutInline as DsLayoutInline } from '@/components/core/Layout';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { Button, SaveButton } from '@/components/core/Button';
import { Checkbox, MultiSelect, Select } from '@/components/core/Input';
import type { PageAccessPolicyValue } from '@/lib/types/page-access';
import {
  canonicalPageAccessPolicy,
  setPageAccessMembership,
  updatePageAccessConditions,
} from '@/features/page/page-access-draft';

export interface PageAccessSettingsProps {
  value: PageAccessPolicyValue;
  tagOptions: { value: string; label: string }[];
  loadingTags?: boolean;
  tagsUnavailable?: boolean;
  disabled?: boolean;
  onSave: (
    value: PageAccessPolicyValue,
  ) => Promise<{ ok: true; accessPolicy?: PageAccessPolicyValue } | { ok: false; error: string }>;
}

type SaveStatus = 'idle' | 'pending' | 'saved' | 'error';

export function PageAccessSettings({
  value,
  tagOptions,
  loadingTags = false,
  tagsUnavailable = false,
  disabled = false,
  onSave,
}: PageAccessSettingsProps) {
  const t = useTranslations('pageEditor.access');
  const valueKey = JSON.stringify(value);
  const [state, setState] = useState(() => ({
    draft: value,
    baseline: value,
    lastValueKey: valueKey,
    status: 'idle' as SaveStatus,
    error: '',
    attemptedSave: false,
  }));
  const dirty = JSON.stringify(state.draft) !== JSON.stringify(state.baseline);
  const pending = state.status === 'pending';

  // Peer updates refresh a pristine form. Unsaved edits remain local until saved or discarded.
  if (valueKey !== state.lastValueKey) {
    setState({
      ...state,
      lastValueKey: valueKey,
      ...(!dirty && !pending && valueKey !== JSON.stringify(state.baseline)
        ? { draft: value, baseline: value, status: 'idle' as SaveStatus, error: '', attemptedSave: false }
        : {}),
    });
  }

  const draft = state.draft;
  const emptyConditions =
    draft.mode === 'conditions' && !draft.roles.length && !draft.userTagIds.length && !draft.newsletterSubscriber;
  const missingTags = draft.userTagIds.filter((id) => !tagOptions.some((option) => option.value === id));
  const tags = [...tagOptions, ...missingTags.map((id) => ({ value: id, label: t('unavailableTag', { id }) }))];
  const update = (changes: Partial<PageAccessPolicyValue>) => {
    setState((current) => ({
      ...current,
      draft: { ...current.draft, ...changes },
      status: 'idle',
      error: '',
      attemptedSave: false,
    }));
  };

  const conditionGroupCount =
    Number(draft.roles.length > 0) + Number(draft.userTagIds.length > 0) + Number(draft.newsletterSubscriber);
  const updateConditions = (changes: Partial<PageAccessPolicyValue>) =>
    update(updatePageAccessConditions(draft, changes));

  async function save() {
    if (emptyConditions) {
      setState((current) => ({ ...current, attemptedSave: true, status: 'idle', error: '' }));
      return;
    }
    const saved = canonicalPageAccessPolicy(draft);
    setState((current) => ({ ...current, status: 'pending', error: '', attemptedSave: false }));
    try {
      const result = await onSave(saved);
      if (result.ok) {
        const canonical = result.accessPolicy ?? saved;
        setState((current) => ({ ...current, draft: canonical, baseline: canonical, status: 'saved' }));
      } else {
        setState((current) => ({ ...current, status: 'error', error: result.error || t('saveError') }));
      }
    } catch {
      setState((current) => ({ ...current, status: 'error', error: t('saveError') }));
    }
  }

  return (
    <DsLayoutStack gap="md">
      <DsLayoutStack gap="xs" role="group" aria-label={t('audience')}>
        <DsText size="sm" weight="medium">
          {t('audience')}
        </DsText>
        <DsText size="xs" tone="secondary">
          {t('audienceDescription')}
        </DsText>
        <Checkbox
          label={t('roleUser')}
          description={t('memberDescription')}
          checked={draft.mode !== 'public'}
          onChange={(event) => update(setPageAccessMembership(draft, event.currentTarget.checked))}
          disabled={disabled || pending}
        />
        <Checkbox
          label={t('roleAuthor')}
          description={t('authorDescription')}
          checked={draft.roles.includes('author')}
          onChange={(event) =>
            updateConditions({
              roles: event.currentTarget.checked
                ? [...draft.roles, 'author']
                : draft.roles.filter((role) => role !== 'author'),
            })
          }
          disabled={disabled || pending}
        />
        <Checkbox
          label={t('roleAdmin')}
          description={t('adminDescription')}
          checked={draft.roles.includes('admin')}
          onChange={(event) =>
            updateConditions({
              roles: event.currentTarget.checked
                ? [...draft.roles, 'admin']
                : draft.roles.filter((role) => role !== 'admin'),
            })
          }
          disabled={disabled || pending}
        />
        <Checkbox
          label={t('newsletter')}
          description={t('newsletterDescription')}
          checked={draft.newsletterSubscriber}
          onChange={(event) => updateConditions({ newsletterSubscriber: event.currentTarget.checked })}
          disabled={disabled || pending}
        />
      </DsLayoutStack>
      {loadingTags ? <PageLoader placement="flow" minHeight={80} size="xs" /> : null}
      <MultiSelect
        label={t('userTags')}
        description={t('userTagsDescription')}
        placeholder={t('userTagsPlaceholder')}
        value={draft.userTagIds}
        onChange={(userTagIds) => updateConditions({ userTagIds })}
        data={tags}
        searchable
        hidePickedOptions
        nothingFoundMessage={t('noTags')}
        disabled={disabled || pending || loadingTags || tagsUnavailable}
      />
      {conditionGroupCount >= 2 ? (
        <Select
          label={t('match')}
          description={t('matchDescription')}
          value={draft.match}
          onChange={(match) => {
            if (match) {
              update({ match: match as PageAccessPolicyValue['match'] });
            }
          }}
          allowDeselect={false}
          disabled={disabled || pending}
          data={[
            { value: 'any', label: t('any') },
            { value: 'all', label: t('all') },
          ]}
        />
      ) : null}
      {state.attemptedSave && emptyConditions ? (
        <SupportingText tone="danger" role="alert">
          {t('emptyConditions')}
        </SupportingText>
      ) : null}
      {state.status === 'error' ? (
        <SupportingText tone="danger" role="alert">
          {state.error}
        </SupportingText>
      ) : null}
      {state.status === 'saved' ? (
        <SupportingText tone="positive" role="status">
          {t('saved')}
        </SupportingText>
      ) : null}
      {dirty ? (
        <DsText size="xs" tone="secondary">
          {t('unsaved')}
        </DsText>
      ) : null}
      <DsLayoutInline gap="xs">
        <SaveButton type="button" onClick={() => void save()} disabled={disabled || !dirty} loading={pending}>
          {pending ? t('saving') : t('save')}
        </SaveButton>
        <Button
          tone="neutral"
          emphasis="low"
          disabled={disabled || pending || !dirty}
          onClick={() =>
            setState({
              draft: value,
              baseline: value,
              lastValueKey: valueKey,
              status: 'idle',
              error: '',
              attemptedSave: false,
            })
          }
        >
          {t('cancel')}
        </Button>
      </DsLayoutInline>
    </DsLayoutStack>
  );
}
