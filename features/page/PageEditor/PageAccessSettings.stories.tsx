import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { LayoutContainer, LayoutStack } from '@/components/core/Layout';
import { Text } from '@/components/core/Typography';
import { DEFAULT_PAGE_ACCESS_POLICY, type PageAccessPolicyValue } from '@/lib/types/page-access';
import { PageAccessSettings } from './PageAccessSettings';

const tagOptions = [
  { value: 'member-tag-supporter', label: '후원 회원' },
  { value: 'member-tag-workshop', label: '워크숍 참여자' },
  { value: 'member-tag-festival', label: '페스티벌 초대 회원' },
];
const initialPolicy: PageAccessPolicyValue = {
  ...DEFAULT_PAGE_ACCESS_POLICY,
  mode: 'conditions',
  roles: [],
  newsletterSubscriber: true,
  userTagIds: [],
};
function AccessSettingsPreview({
  readOnly = false,
  saveFailure = false,
}: {
  readOnly?: boolean;
  saveFailure?: boolean;
}) {
  const t = useTranslations();
  const [policy, setPolicy] = useState(initialPolicy);
  const [failNextSave, setFailNextSave] = useState(saveFailure);
  const [saved, setSaved] = useState(false);
  return (
    <LayoutContainer size="compact" inset="md">
      <LayoutStack gap="sm">
        <PageAccessSettings
          value={policy}
          tagOptions={tagOptions}
          disabled={readOnly}
          onSave={async (value) => {
            if (failNextSave) {
              setFailNextSave(false);
              return { ok: false, error: t('pageEditor.access.saveError') };
            }
            setPolicy(value);
            setSaved(true);
            return { ok: true };
          }}
        />
        {saved && <Text role="status">{t('common.notifications.saveSuccess')}</Text>}
      </LayoutStack>
    </LayoutContainer>
  );
}
const meta = {
  title: 'Feature/Page/Editor Settings',
  component: AccessSettingsPreview,
  parameters: { canvasInset: 'none', layout: 'padded' },
} satisfies Meta<typeof AccessSettingsPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const CombinedPageEditorSettings: Story = { name: 'Access Policy' };
export const Mobile: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };
export const Readonly: Story = { args: { readOnly: true } };
export const SaveFailure: Story = { args: { saveFailure: true } };
