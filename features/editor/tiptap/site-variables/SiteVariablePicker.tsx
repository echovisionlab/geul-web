'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { resolveSiteVariable } from '@echovisionlab/geul-common/site-variables';
import { isSiteVariableKey, siteVariableKeys } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import { Select } from '@/components/core/Input';
import { LayoutStack } from '@/components/core/Layout';
import { SupportingText } from '@/components/core/Typography';
import { useSiteSettings } from '@/lib/contexts/ManifestContext';
import { siteVariableContext, siteVariableLabelKeys } from '@/lib/site-variables';
import classes from './SiteVariablePicker.module.css';

/** The host owns only caret placement. Core Select owns the combobox and grouped listbox. */
export function SiteVariablePicker({
  position,
  onSelect,
  onClose,
}: {
  position: { left: number; top: number };
  onSelect: (key: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations('editorCommon.editor.siteVariables');
  const { settings } = useSiteSettings();
  const context = siteVariableContext(settings);
  const [query, setQuery] = useState('');
  const options = siteVariableKeys.map((key) => ({ value: key, label: t(siteVariableLabelKeys[key]) }));
  return (
    <div
      className={classes.anchor}
      style={{ left: position.left, top: position.top }}
      data-testid="site-variable-picker"
    >
      <Select
        label={t('title')}
        description={t('description')}
        autoFocus
        searchable
        dropdownOpened
        placeholder={t('search')}
        searchValue={query}
        onSearchChange={setQuery}
        getSearchText={(option) =>
          `${option.label} ${option.value} ${isSiteVariableKey(option.value) ? resolveSiteVariable(option.value, context) : ''}`
        }
        data={[
          { group: t('site'), items: options.filter((option) => option.value.startsWith('site.')) },
          { group: t('contact'), items: options.filter((option) => option.value.startsWith('contact.')) },
        ]}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            onClose();
          }
        }}
        onDropdownClose={onClose}
        onChange={(key) => {
          if (key !== null && isSiteVariableKey(key)) {
            onSelect(key);
          }
        }}
        renderOption={({ option }) => (
          <LayoutStack gap="xxs">
            <span>{option.label}</span>
            <SupportingText tone="muted">
              <bdi>
                {isSiteVariableKey(option.value) ? resolveSiteVariable(option.value, context) || t('unset') : ''}
              </bdi>
            </SupportingText>
          </LayoutStack>
        )}
      />
    </div>
  );
}
