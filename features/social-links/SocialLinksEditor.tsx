'use client';

import { useTranslations } from 'next-intl';
import type { SocialLinks } from '@/lib/types/common/social-links';
import { isValidPlatform, normalizeToUrl } from '@/lib/utils/social-links';
import { getSocialLinkInputViewModel, SOCIAL_PLATFORM_OPTIONS } from './social-link-view-model';
import { SocialLinksEditorView } from './ui/SocialLinksEditorView';
import { useSocialLinksEditor } from './useSocialLinksEditor';

export interface SocialLinksEditorProps {
  value: SocialLinks;
  onChange: (links: SocialLinks) => void;
  idPrefix?: string;
  disabled?: boolean;
  maxLinks?: number;
  label?: string;
  addButtonMode?: 'button' | 'icon';
}

export function SocialLinksEditor({ value, onChange, maxLinks = 20, ...viewProps }: SocialLinksEditorProps) {
  const t = useTranslations('socialLinks');
  const tCommonActions = useTranslations('common.actions');
  const { items, canAddMore, addLink, removeLink, updateLink, moveLink } = useSocialLinksEditor({
    value,
    onChange,
    maxLinks,
  });
  const viewItems = items.map((item) => ({ ...item, ...getSocialLinkInputViewModel(item.platform) }));

  const handleValueBlur = (index: number) => {
    const item = items[index];
    if (!item || !item.value || !isValidPlatform(item.platform)) {
      return;
    }
    const normalized = normalizeToUrl(item.platform, item.value);
    if (normalized !== item.value) {
      updateLink(index, 'value', normalized);
    }
  };

  return (
    <SocialLinksEditorView
      {...viewProps}
      items={viewItems}
      platformOptions={SOCIAL_PLATFORM_OPTIONS}
      labels={{
        fieldLabel: t('label'),
        addLink: t('addLink'),
        reorderLink: 'Reorder social link',
        platformPlaceholder: t('platformPlaceholder'),
        valuePlaceholder: t('valuePlaceholder'),
        remove: tCommonActions('remove'),
      }}
      canAddMore={canAddMore}
      onAddLink={addLink}
      onRemoveLink={removeLink}
      onPlatformChange={(index, platform) => updateLink(index, 'platform', platform)}
      onValueChange={(index, nextValue) => updateLink(index, 'value', nextValue)}
      onValueBlur={handleValueBlur}
      onMoveLink={moveLink}
    />
  );
}
