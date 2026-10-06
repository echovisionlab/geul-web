import { useState } from 'react';
import { Box, Group, Stack, Text, Title } from '@mantine/core';
import { LabelBadge } from '@/components/core/Badge';
import { Button } from '@/components/core/Button';
import { Checkbox, TextInput } from '@/components/core/Input';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { SectionCard, SectionHeader } from '@/components/core/Section';
import { MetadataPanel } from '@/features/metadata/MetadataPanel/MetadataPanel';
import { EmbedFrame } from '@/features/page/blocks/embed/EmbedFrame';
import { EmbedSettingsForm } from '@/features/page/blocks/embed/SettingsForm';
import { parseEmbedProps } from '@/features/page/blocks/embed/schema';
import { DEFAULT_PAGE_ACCESS_POLICY, type PageAccessPolicyValue } from '@/lib/types/page-access';
import { PageAccessSettings } from './PageAccessSettings';
import classes from './PageAccessSettings.stories.module.css';

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

function CombinedPageEditorSettingsStory({
  readOnly = false,
  saveFailure = false,
}: {
  readOnly?: boolean;
  saveFailure?: boolean;
}) {
  const [title, setTitle] = useState('사운드 워크숍 · 회원 자료실');
  const [savedPolicy, setSavedPolicy] = useState(initialPolicy);
  const [reload, setReload] = useState(0);
  const [failNextSave, setFailNextSave] = useState(saveFailure);
  const [saveCount, setSaveCount] = useState(0);
  const [embed, setEmbed] = useState(
    parseEmbedProps({
      uri: 'https://www.openstreetmap.org/export/embed.html?bbox=126.955%2C37.557%2C126.973%2C37.567&layer=mapnik',
      title: '워크숍 위치',
      heightMode: 'fixed',
      height: '360',
      allowScripts: 'true',
    }),
  );
  const updateEmbed = (next: Record<string, unknown>) =>
    setEmbed((current) => parseEmbedProps({ ...current, ...next }));
  const audienceLabel = { public: '모든 방문자', authenticated: '로그인한 회원', conditions: '조건에 맞는 회원' }[
    savedPolicy.mode
  ];

  return (
    <Box p="md">
      <Stack gap="lg">
        <Group justify="space-between">
          <Stack gap={4}>
            <Title order={2}>Page 편집 · 설정 흐름 검토</Title>
            <Text size="sm" c="dimmed">
              실제 권한 설정 컴포넌트를 사용합니다. 저장은 UI 검토용 시뮬레이션입니다.
            </Text>
          </Stack>
          <LabelBadge tone="neutral">{readOnly ? '읽기 전용' : 'UI 검토'}</LabelBadge>
        </Group>
        <div className={classes.layout}>
          <Stack className={classes.body} gap="md">
            <SectionCard>
              <Stack gap="md">
                <TextInput
                  label="제목"
                  value={title}
                  onChange={(event) => setTitle(event.currentTarget.value)}
                  disabled={readOnly}
                />
                <Text size="sm" c="dimmed">
                  뉴스레터를 선택하면 회원도 함께 선택됩니다. 저장 후에도 구독 조건으로 열람 대상을 제한합니다.
                </Text>
              </Stack>
            </SectionCard>
            <SectionCard>
              <Stack gap="md">
                <SectionHeader title="본문 · 외부 콘텐츠" description="임베드 미리보기와 설정을 함께 확인합니다." />
                <EmbedFrame props={embed} preview />
              </Stack>
            </SectionCard>
          </Stack>
          <Stack className={classes.sidebar} gap="md">
            <SectionCard>
              <Stack gap="md">
                <SectionHeader title="권한" />
                <PageAccessSettings
                  key={reload}
                  value={savedPolicy}
                  tagOptions={tagOptions}
                  disabled={readOnly}
                  onSave={async (value) => {
                    await new Promise((resolve) => setTimeout(resolve, 400));
                    if (failNextSave) {
                      setFailNextSave(false);
                      return {
                        ok: false,
                        error: 'UI 검토용 저장 실패입니다. 설정을 유지한 채 다시 저장할 수 있습니다.',
                      };
                    }
                    setSavedPolicy(value);
                    setSaveCount((count) => count + 1);
                    return { ok: true };
                  }}
                />
              </Stack>
            </SectionCard>
            <SectionCard>
              <Stack gap="sm">
                <SectionHeader title="저장 흐름 확인" />
                <Text size="sm" role="status">
                  저장된 열람 대상: {audienceLabel} · 저장 {saveCount}회
                </Text>
                <Checkbox
                  label="다음 저장 실패 시뮬레이션"
                  checked={failNextSave}
                  onChange={(event) => setFailNextSave(event.currentTarget.checked)}
                  disabled={readOnly}
                />
                <Button tone="neutral" emphasis="medium" onClick={() => setReload((value) => value + 1)}>
                  저장된 설정으로 다시 열기
                </Button>
              </Stack>
            </SectionCard>
            <SectionCard>
              <Stack gap="md">
                <SectionHeader title="외부 콘텐츠 설정" />
                <EmbedSettingsForm
                  props={embed}
                  allowSharedEdits={!readOnly}
                  updateSharedProps={updateEmbed}
                  updateLocalizedProps={updateEmbed}
                />
              </Stack>
            </SectionCard>
            <MetadataPanel
              title={title}
              summary="워크숍 회원 자료와 외부 콘텐츠를 모은 페이지입니다."
              routePath="/workshop-members"
              canonicalOrigin="https://www.dsub.io"
              siteName="DSUB"
              defaultSchemaType="WebPage"
            />
          </Stack>
        </div>
      </Stack>
    </Box>
  );
}

const meta: Meta<typeof PageAccessSettings> = {
  title: 'Feature/Page/Editor Settings',
  component: PageAccessSettings,
  globals: { locale: 'ko' },
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof PageAccessSettings>;

export const CombinedPageEditorSettings: Story = { render: () => <CombinedPageEditorSettingsStory /> };
export const Mobile: Story = {
  render: () => (
    <div style={{ width: 390, maxWidth: '100%' }}>
      <CombinedPageEditorSettingsStory />
    </div>
  ),
};
export const Dark: Story = { render: () => <CombinedPageEditorSettingsStory />, globals: { theme: 'dark' } };
export const Readonly: Story = { render: () => <CombinedPageEditorSettingsStory readOnly /> };
export const SaveFailure: Story = { render: () => <CombinedPageEditorSettingsStory saveFailure /> };
