import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { localizeFixtureTree, useStorybookText } from '../../.storybook/fixture-i18n';
import { useState } from 'react';
import { Button } from '@/components/core/Button';
import { DropdownMenu } from '@/components/core/DropdownMenu';
import { Checkbox, Select, TextInput } from '@/components/core/Input';
import { FormModal } from '@/components/core/Modal/FormModal';
import { Tabs } from '@/components/core/Tabs';
import { PreviewFrame, type PreviewState } from './PreviewFrame';

export function InputPreview({ state = 'ready' }: { state?: PreviewState }) {
  const fixtureText = useStorybookText();
  const [name, setName] = useState('Field notes');
  const [visibility, setVisibility] = useState<string | null>('private');
  const [notify, setNotify] = useState(false);
  const disabled = state === 'disabled' || state === 'pending';
  return localizeFixtureTree(
    <PreviewFrame
      title="Input · controlled values"
      description="Edit text, choose a value, and toggle the checkbox. Change State in Controls to inspect errors and disabled fields."
    >
      <DsLayoutStack>
        <TextInput
          label="Collection name"
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
          disabled={disabled}
          error={state === 'error' ? 'This name is already in use.' : undefined}
        />
        <Select
          label="Visibility"
          data={[
            { value: 'private', label: 'Private' },
            { value: 'public', label: 'Public' },
          ]}
          value={visibility}
          onChange={setVisibility}
          disabled={disabled}
          allowDeselect={false}
        />
        <Checkbox
          label="Notify collaborators"
          checked={notify}
          onChange={(event) => setNotify(event.currentTarget.checked)}
          disabled={disabled}
        />
        <DsText size="sm" role="status" aria-live="polite">
          {name || fixtureText('Untitled')} · {fixtureText(visibility === 'private' ? 'Private' : 'Public')} ·{' '}
          {fixtureText(notify ? 'Enabled' : 'Disabled')}
        </DsText>
      </DsLayoutStack>
    </PreviewFrame>,
    fixtureText,
  );
}

export function MenuPreview() {
  const fixtureText = useStorybookText();
  const [visibility, setVisibility] = useState('Private');
  return localizeFixtureTree(
    <PreviewFrame
      title="Dropdown menu · selection"
      description="Open with a pointer or keyboard, select an item, then inspect the selected state."
    >
      <DropdownMenu>
        <DropdownMenu.Target>
          <Button tone="neutral" emphasis="medium">
            {fixtureText('Visibility')}: {fixtureText(visibility)}
          </Button>
        </DropdownMenu.Target>
        <DropdownMenu.Dropdown>
          <DropdownMenu.Label>Visibility</DropdownMenu.Label>
          {['Private', 'Unlisted', 'Public'].map((value) => (
            <DropdownMenu.Item key={value} selected={visibility === value} onClick={() => setVisibility(value)}>
              {value}
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Divider />
          <DropdownMenu.Item disabled>Organization only</DropdownMenu.Item>
        </DropdownMenu.Dropdown>
      </DropdownMenu>
      <DsText size="sm" role="status" aria-live="polite">
        {fixtureText('Selected: {value}', { value: fixtureText(visibility) })}
      </DsText>
    </PreviewFrame>,
    fixtureText,
  );
}

export function ModalPreview({ state = 'ready' }: { state?: PreviewState }) {
  const fixtureText = useStorybookText();
  const [opened, setOpened] = useState(false);
  const [name, setName] = useState('Field notes');
  const [savedName, setSavedName] = useState('Field notes');
  return localizeFixtureTree(
    <PreviewFrame
      title="Form modal · open, edit, submit"
      description="Open the dialog, edit its field, and save. Escape or Cancel closes it without saving."
    >
      <Button
        onClick={() => {
          setName(savedName);
          setOpened(true);
        }}
        disabled={state === 'disabled'}
      >
        Rename collection
      </Button>
      <DsText size="sm" role="status" aria-live="polite">
        {fixtureText('Saved name: {name}', { name: savedName })}
      </DsText>
      <FormModal
        opened={opened}
        onClose={() => setOpened(false)}
        onSubmit={() => {
          setSavedName(name.trim());
          setOpened(false);
        }}
        title="Rename collection"
        submitLabel="Save name"
        cancelLabel="Cancel"
        closeLabel="Close rename dialog"
        loading={state === 'pending'}
        submitDisabled={!name.trim() || state === 'disabled' || state === 'error'}
      >
        <TextInput
          label="Name"
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
          disabled={state === 'pending' || state === 'disabled'}
          error={state === 'error' ? 'This name is already in use.' : undefined}
        />
      </FormModal>
    </PreviewFrame>,
    fixtureText,
  );
}

export function TabsPreview({ appearance = 'line' }: { appearance?: 'line' | 'outline' | 'pills' }) {
  const fixtureText = useStorybookText();
  const [value, setValue] = useState<string | null>('overview');
  return localizeFixtureTree(
    <PreviewFrame
      title="Tabs · controlled navigation"
      description="Switch panels with a pointer or arrow keys. The Appearance control exposes the production variants."
    >
      <Tabs value={value} onChange={setValue} appearance={appearance}>
        <Tabs.List aria-label="Collection sections">
          <Tabs.Tab value="overview">Overview</Tabs.Tab>
          <Tabs.Tab value="activity">Activity</Tabs.Tab>
          <Tabs.Tab value="settings">Settings</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="overview" paddingTop="md">
          <DsText size="sm">3 entries · Private collection</DsText>
        </Tabs.Panel>
        <Tabs.Panel value="activity" paddingTop="md">
          <DsText size="sm">Field notes updated today.</DsText>
        </Tabs.Panel>
        <Tabs.Panel value="settings" paddingTop="md">
          <DsText size="sm">Collection settings panel</DsText>
        </Tabs.Panel>
      </Tabs>
    </PreviewFrame>,
    fixtureText,
  );
}
