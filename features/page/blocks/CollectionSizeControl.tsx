'use client';

import { useTranslations } from 'next-intl';
import { Select } from '@/components/core/Input';
import {
  COLLECTION_SIZES,
  DEFAULT_COLLECTION_SIZE,
  type CollectionSize,
} from '@/components/core/Collection/collection-contract';

interface CollectionSizeControlProps {
  value?: CollectionSize;
  disabled?: boolean;
  onChange: (value: CollectionSize) => void;
}

/** Page presentation option derived directly from the Core collection contract. */
export function CollectionSizeControl({
  value = DEFAULT_COLLECTION_SIZE,
  onChange,
  disabled = false,
}: CollectionSizeControlProps) {
  const t = useTranslations('pageEditor');

  return (
    <Select
      disabled={disabled}
      label={t('blockEditor.labels.itemSize')}
      data={COLLECTION_SIZES.map((size) => ({ value: size, label: t(`blockEditor.options.itemSize.${size}`) }))}
      value={value}
      onChange={(next) => {
        if (!disabled && next && COLLECTION_SIZES.includes(next as CollectionSize)) {
          onChange(next as CollectionSize);
        }
      }}
    />
  );
}
