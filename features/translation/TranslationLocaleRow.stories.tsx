import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { useLocale, useTranslations } from 'next-intl';
import { IconPencil, IconTrash } from '@tabler/icons-react';
import { Field } from '@/components/core/Field';
import { TextInput } from '@/components/core/Input';
import { LayoutStack } from '@/components/core/Layout';
import { ToolbarCommand } from '@/components/core/Section';
import { TranslationLocaleControl } from './TranslationLocaleControl';
import { TranslationLocaleRow } from './TranslationLocaleRow';
import { TranslationPanelSectionCard } from './TranslationPanelSectionCard';
function SharedPanel({ readOnly = false, expanded = true }: { readOnly?: boolean; expanded?: boolean }) {
  const t = useTranslations('translationPanel');
  const actions = useTranslations('common.actions');
  const labels = useTranslations('common.labels');
  const entities = useTranslations('common.entities');
  const locale = useLocale();
  const [source, setSource] = useState('ko');
  const [translated, setTranslated] = useState(['en']);
  const [editing, setEditing] = useState<string | null>(null);
  const [content, setContent] = useState<Record<string, string>>({ en: 'An independent archive.' });
  const language = new Intl.DisplayNames([locale], { type: 'language' });
  return (
    <TranslationPanelSectionCard
      title={entities('translations')}
      description={t('description')}
      defaultExpanded={expanded}
      expandLabel={t('actions.expand')}
      collapseLabel={t('actions.collapse')}
    >
      <LayoutStack gap="md">
        <Field layout="inline" label={t('sourceLocale.label')} description={t('sourceLocale.description')}>
          <TranslationLocaleControl
            variant="native-select"
            density="compact"
            sourceLocale={source}
            value={source}
            onChange={(value) => {
              if (value) {
                setSource(value);
              }
            }}
            options={['ko', 'en', 'ja'].map((code) => ({ value: code, label: language.of(code) ?? code }))}
            disabled={readOnly}
          />
        </Field>
        {['ko', 'en', 'ja']
          .filter((code) => code !== source)
          .map((code) => (
            <TranslationLocaleRow
              key={code}
              code={code}
              name={language.of(code)!}
              description={translated.includes(code) ? content[code] : t('states.missingTarget')}
              actionsLabel={`${labels('actions')}: ${language.of(code)}`}
              actions={
                readOnly ? null : (
                  <>
                    <ToolbarCommand
                      presentation="icon"
                      label={actions('edit')}
                      icon={<IconPencil size="1em" />}
                      onClick={() => setEditing(editing === code ? null : code)}
                    />
                    {translated.includes(code) && (
                      <ToolbarCommand
                        presentation="icon"
                        label={actions('delete')}
                        tone="danger"
                        onClick={() => {
                          setTranslated((values) => values.filter((value) => value !== code));
                          setContent((values) => ({ ...values, [code]: '' }));
                        }}
                        icon={<IconTrash size="1em" />}
                      />
                    )}
                  </>
                )
              }
            />
          ))}
        {editing && (
          <TextInput
            label={`${actions('edit')}: ${language.of(editing)}`}
            value={content[editing] ?? ''}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setContent((values) => ({ ...values, [editing]: value }));
              setTranslated((values) => (values.includes(editing) ? values : [...values, editing]));
            }}
          />
        )}
      </LayoutStack>
    </TranslationPanelSectionCard>
  );
}
const meta = { title: 'Feature/Translation/LocaleRows', component: SharedPanel } satisfies Meta<typeof SharedPanel>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Expanded: Story = {};
export const ReadOnly: Story = { args: { readOnly: true } };
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };

export const Tablet: Story = { globals: { viewport: { value: 'tablet', isRotated: false } } };
export const Desktop: Story = { globals: { viewport: { value: 'desktop', isRotated: false } } };

export const Collapsed: Story = { args: { expanded: false } };
