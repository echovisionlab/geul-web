import type { Meta, StoryObj } from '@storybook/nextjs';
import { useState } from 'react';
import { useLocale } from 'next-intl';
import { IconCheck, IconDots, IconTrash } from '@tabler/icons-react';
import { Button } from '@/components/core/Button';
import { IconButton } from '@/components/core/IconButton';
import { TextButton } from '@/components/core/TextButton';
import { Select, TextInput } from '@/components/core/Input';
import { LayoutStack, LayoutInline } from '@/components/core/Layout';
import { ToolbarSurface } from '@/components/core/Section/ToolbarSurface';
import { ToolbarCommand } from '@/components/core/Section/ToolbarCommand';
import { ActionRowSizeProvider } from '@/components/core/control-context';
import { DropdownMenu } from '@/components/core/DropdownMenu';
import { Text } from '@/components/core/Typography';

const meta = { title: 'Composition/Size and Density', parameters: { layout: 'fullscreen' } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
function DensityPreview() {
  const locale = useLocale();
  const labels =
    locale === 'ko'
      ? ['저장', '참가자 관리', '공동 편집자와 게시 권한 관리']
      : locale === 'ar'
        ? ['حفظ', 'إدارة المشاركين', 'إدارة أذونات النشر والتحرير المشتركة']
        : locale === 'de'
          ? ['Speichern', 'Teilnehmende verwalten', 'Gemeinsame Bearbeitungs- und Veröffentlichungsrechte']
          : ['Save', 'Manage participants', 'Shared editing and publishing permissions'];
  const [role, setRole] = useState<string | null>('editor');
  const [name, setName] = useState('');
  const [saved, setSaved] = useState('');
  const [selected, setSelected] = useState(true);
  const save = () => setSaved(name || labels[0]);
  const manage = () => setRole((value) => (value === 'editor' ? 'viewer' : 'editor'));
  return (
    <LayoutStack gap="lg" data-density-preview>
      <ActionRowSizeProvider size="sm">
        <LayoutInline gap="xs" wrap="wrap" data-density-row>
          <Button size="lg" leftSection={<IconCheck />} onClick={save}>
            {labels[0]}
          </Button>
          <IconButton size="xs" label={labels[1]} onClick={manage}>
            <IconDots />
          </IconButton>
          <TextButton controlSize="md" density="chrome" onClick={manage}>
            {labels[1]}
          </TextButton>
        </LayoutInline>
      </ActionRowSizeProvider>
      <ToolbarSurface label={labels[1]} density="compact" width="full">
        <ToolbarCommand label={labels[0]} icon={<IconCheck />} presentation="responsive" onClick={save} />
        <ToolbarCommand label={labels[2]} icon={<IconDots />} presentation="responsive" onClick={manage} />
        <IconButton label="Delete" disabled>
          <IconTrash />
        </IconButton>
        <Button loading>Pending</Button>
        <Button aria-pressed={selected} onClick={() => setSelected((value) => !value)}>
          Selected
        </Button>
      </ToolbarSurface>
      <TextInput
        label={labels[1]}
        density="compact"
        error={!name ? 'Required' : undefined}
        value={name}
        onChange={(event) => setName(event.currentTarget.value)}
      />
      <Select
        label={labels[1]}
        width="content"
        clearable
        value={role}
        onChange={setRole}
        data={[
          { value: 'editor', label: labels[2] },
          { value: 'viewer', label: labels[0] },
        ]}
      />
      <DropdownMenu>
        <DropdownMenu.Target>
          <Button data-menu-trigger>{labels[1]}</Button>
        </DropdownMenu.Target>
        <DropdownMenu.Dropdown>
          <DropdownMenu.Item onClick={manage}>{labels[2]}</DropdownMenu.Item>
          <DropdownMenu.Item disabled>Disabled</DropdownMenu.Item>
        </DropdownMenu.Dropdown>
      </DropdownMenu>
      <Text role="status">
        {saved} · {role}
      </Text>
    </LayoutStack>
  );
}
export const SharedOwners: Story = { render: () => <DensityPreview /> };
