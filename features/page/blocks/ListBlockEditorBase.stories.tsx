import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { InputSizeProvider, TextInput } from '@/components/core/Input';
import type { CollectionSize } from '@/components/core/Collection/collection-contract';
import { ListBlockEditorBase } from './ListBlockEditorBase';

function Settings({
  carousel = false,
  withFilters = true,
  itemSize = 'm',
  readOnly = false,
}: {
  carousel?: boolean;
  withFilters?: boolean;
  itemSize?: CollectionSize;
  readOnly?: boolean;
}) {
  const t = useTranslations();
  const [values, setValues] = useState({
    layout: carousel ? 'carousel' : 'grid',
    itemSize,
    columns: '3',
    limit: '12',
    sortBy: 'published_at',
    sortOrder: 'desc',
    showPagination: 'true',
    showImage: 'true',
    imageAspectRatio: 'auto',
    carouselLoop: 'true',
    carouselIndicators: 'true',
  });
  return (
    <InputSizeProvider size="xs">
      <div style={{ width: 360, maxWidth: '100%' }}>
        <ListBlockEditorBase
          {...values}
          readOnly={readOnly}
          editorType="post-list"
          limitLabel={t('pageEditor.blockEditor.labels.rowsPerPage')}
          maxLimit={100}
          defaultLimit="12"
          defaultColumns="3"
          sortByOptions={[{ value: 'published_at', label: t('common.labels.published') }]}
          filters={withFilters ? <TextInput label={t('common.labels.title')} disabled={readOnly} /> : undefined}
          onUpdate={(key, value) => setValues((current) => ({ ...current, [key]: value }))}
        />
      </div>
    </InputSizeProvider>
  );
}

const meta = {
  title: 'Feature/Page/List Block Settings',
  component: Settings,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Settings>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ContentThenPresentation: Story = {};
export const Carousel: Story = { args: { carousel: true } };
export const WithoutFilters: Story = { args: { withFilters: false } };
export const SmallItems: Story = { args: { itemSize: 's' } };
export const LargeItems: Story = { args: { itemSize: 'l' } };
export const ReadOnly: Story = { args: { readOnly: true } };
export const Narrow: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };
