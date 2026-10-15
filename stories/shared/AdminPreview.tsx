import { localizeFixtureTree, useStorybookText } from '../../.storybook/fixture-i18n';
import { useState } from 'react';
import { TextInput } from '@/components/core/Input';
import { FormModal } from '@/components/core/Modal/FormModal';
import { AdminPageHeader } from '@/features/admin/ui/AdminPageHeader/AdminPageHeader';
import { CollectionTablePreview, collectionRows } from './CompositionPreviews';
import { PreviewFrame, type PreviewState } from './PreviewFrame';

export function AdminPreview({ state = 'ready', empty = false }: { state?: PreviewState; empty?: boolean }) {
  const fixtureText = useStorybookText();
  const [rows, setRows] = useState(empty ? [] : collectionRows);
  const [opened, setOpened] = useState(false);
  const [name, setName] = useState('');
  const [nextId, setNextId] = useState(1);
  return localizeFixtureTree(
    <PreviewFrame
      wide
      title="Composition · admin workspace pattern"
      description="Production AdminPageHeader, Core table, inputs, and modal composed at page scale. This is a reusable composition example; no application route is claimed. Create a local entry, then filter, sort, select, or rename it."
    >
      <AdminPageHeader
        level={2}
        title="Collections"
        description="Organize publishing collections"
        items={[
          {
            key: 'create',
            type: 'action',
            label: 'New collection',
            disabled: state === 'disabled',
            onClick: () => {
              setName('');
              setOpened(true);
            },
          },
        ]}
      />
      <CollectionTablePreview rows={rows} state={state} />
      <FormModal
        opened={opened}
        onClose={() => setOpened(false)}
        title="New collection"
        submitLabel="Create"
        cancelLabel="Cancel"
        closeLabel="Close new collection dialog"
        loading={state === 'pending'}
        submitDisabled={!name.trim() || state !== 'ready'}
        onSubmit={() => {
          setRows((items) => [...items, { id: `new-${nextId}`, name: name.trim(), visibility: 'Private' }]);
          setNextId((value) => value + 1);
          setOpened(false);
        }}
      >
        <TextInput
          label="Name"
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
          error={state === 'error' ? 'The collection could not be created.' : undefined}
          disabled={state === 'pending'}
        />
      </FormModal>
    </PreviewFrame>,
    fixtureText,
  );
}
