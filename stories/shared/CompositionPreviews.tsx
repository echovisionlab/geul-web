import { LayoutStack as DsLayoutStack, LayoutInline as DsLayoutInline } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { localizeFixtureTree, useStorybookText } from '../../.storybook/fixture-i18n';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Alert } from '@/components/core/Alert';
import { Button } from '@/components/core/Button';
import { DataTableView } from '@/components/core/DataTable/DataTableView';
import { Checkbox, Select, TextInput } from '@/components/core/Input';
import { FormModal } from '@/components/core/Modal/FormModal';
import { PreviewFrame, type PreviewState } from './PreviewFrame';

export interface CollectionRow {
  id: string;
  name: string;
  visibility: string;
}
export const collectionRows: CollectionRow[] = [
  { id: 'field', name: 'Field recordings', visibility: 'Private' },
  { id: 'studio', name: 'Studio journal', visibility: 'Public' },
  { id: 'work', name: 'Work in progress', visibility: 'Unlisted' },
];

export function CollectionFormPreview({ state = 'ready' }: { state?: PreviewState }) {
  const fixtureText = useStorybookText();
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<string | null>('private');
  const [notify, setNotify] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const disabled = state === 'disabled' || state === 'pending';
  return localizeFixtureTree(
    <PreviewFrame
      title="Composition · collection form"
      description="Submit an empty name to inspect validation. Enter a name and submit to inspect the result. All values stay in this preview."
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setAttempted(true);
          setSubmitted(!!name.trim() && state === 'ready');
        }}
      >
        <DsLayoutStack>
          <TextInput
            label="Name"
            value={name}
            onChange={(event) => {
              setName(event.currentTarget.value);
              setSubmitted(false);
            }}
            disabled={disabled}
            error={attempted && !name.trim() ? 'Enter a name.' : undefined}
          />
          <Select
            label="Visibility"
            data={['private', 'unlisted', 'public'].map((value) => ({
              value,
              label: fixtureText(value[0].toUpperCase() + value.slice(1)),
            }))}
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
          {state === 'error' ? (
            <Alert tone="danger" role="alert">
              The collection could not be saved. Your inputs are preserved.
            </Alert>
          ) : null}
          {submitted ? (
            <Alert tone="positive" role="status">
              {fixtureText('Created {name}', { name: name.trim() })} ·{' '}
              {fixtureText(visibility === 'private' ? 'Private' : visibility === 'unlisted' ? 'Unlisted' : 'Public')} ·{' '}
              {fixtureText(notify ? 'Enabled' : 'Disabled')}
            </Alert>
          ) : null}
          <DsLayoutInline>
            <Button type="submit" loading={state === 'pending'} disabled={disabled}>
              Create collection
            </Button>
            <Button
              tone="neutral"
              emphasis="low"
              disabled={disabled}
              onClick={() => {
                setName('');
                setVisibility('private');
                setNotify(false);
                setAttempted(false);
                setSubmitted(false);
              }}
            >
              Reset
            </Button>
          </DsLayoutInline>
        </DsLayoutStack>
      </form>
    </PreviewFrame>,
    fixtureText,
  );
}

/** Shared preview adapter for the composition and admin-page examples; never imported by production. */
export function CollectionTablePreview({
  empty = false,
  state = 'ready',
  rows = collectionRows,
}: {
  empty?: boolean;
  state?: PreviewState;
  rows?: CollectionRow[];
}) {
  const fixtureText = useStorybookText();
  const locale = useLocale();
  const tCommon = useTranslations('common');
  const [search, setSearch] = useState('');
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc');
  const [selected, setSelected] = useState<string[]>([]);
  const [active, setActive] = useState<CollectionRow | null>(null);
  const [name, setName] = useState('');
  const [renames, setRenames] = useState<Record<string, string>>({});
  const visibleRows = (empty ? [] : rows)
    .map((row) => ({ ...row, name: renames[row.id] ?? row.name }))
    .filter((row) => row.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, locale) * (direction === 'asc' ? 1 : -1));
  const openRow = (row: CollectionRow) => {
    setActive(row);
    setName(row.name);
  };
  return localizeFixtureTree(
    <DsLayoutStack>
      <DsLayoutInline align="end" justify="between">
        <TextInput
          label="Search collections"
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          disabled={state === 'disabled'}
        />
        <DsText size="sm" role="status" aria-live="polite">
          {fixtureText('{count} selected · {shown} shown', { count: selected.length, shown: visibleRows.length })}
        </DsText>
        <Button
          tone="neutral"
          emphasis="low"
          onClick={() => {
            setSearch('');
            setSelected([]);
            setRenames({});
          }}
          disabled={state === 'disabled'}
        >
          Reset table
        </Button>
      </DsLayoutInline>
      {state === 'error' ? (
        <Alert tone="danger" role="alert">
          Collections could not be refreshed. The previous rows remain available.
        </Alert>
      ) : null}
      <DataTableView
        rows={visibleRows}
        getRowKey={(row) => row.id}
        columns={[
          {
            key: 'name',
            header: 'Name',
            renderCell: (row) => row.name,
            sort: {
              ariaLabel: fixtureText('Sort by {label}', { label: fixtureText('Name') }),
              direction,
              onToggle: () => setDirection((value) => (value === 'asc' ? 'desc' : 'asc')),
              disabled: state === 'disabled',
            },
          },
          { key: 'visibility', header: 'Visibility', renderCell: (row) => fixtureText(row.visibility) },
          {
            key: 'actions',
            header: '',
            accessibleLabel: tCommon('labels.actions'),
            kind: 'action',
            renderCell: (row) => (
              <Button
                size="xs"
                tone="neutral"
                emphasis="low"
                disabled={state === 'disabled'}
                onClick={() => openRow(row)}
              >
                Rename
              </Button>
            ),
          },
        ]}
        selection={{
          selectedRowKeys: selected,
          onSelectedRowKeysChange: setSelected,
          getRowLabel: (row) => fixtureText('Select {name}', { name: row.name }),
          selectAllRowsLabel: fixtureText('Select all'),
        }}
        rowAction={{ onActivate: openRow, getAccessibleLabel: (row) => `${fixtureText('Open')} ${row.name}` }}
        rowInteraction={{ isDisabled: () => state === 'disabled' }}
        emptyMessage={search ? 'No matching collections.' : 'No collections yet.'}
        loading={state === 'pending'}
        loadingContent={
          <DsText role="status" size="sm">
            Loading collections…
          </DsText>
        }
        reservedRowCount={3}
      />
      <FormModal
        opened={active !== null}
        onClose={() => setActive(null)}
        title="Rename collection"
        submitLabel="Save name"
        cancelLabel="Cancel"
        closeLabel="Close collection dialog"
        submitDisabled={!name.trim()}
        onSubmit={() => {
          if (active) {
            setRenames((values) => ({ ...values, [active.id]: name.trim() }));
          }
          setActive(null);
        }}
      >
        <TextInput label="Collection name" value={name} onChange={(event) => setName(event.currentTarget.value)} />
      </FormModal>
    </DsLayoutStack>,
    fixtureText,
  );
}

export function TableCompositionPreview(props: { state?: PreviewState; empty?: boolean }) {
  const fixtureText = useStorybookText();
  return localizeFixtureTree(
    <PreviewFrame
      wide
      title="Composition · data table"
      description="Filter, sort, select rows, and rename an entry. Resize to Phone to inspect the same Core table's mobile layout."
    >
      <CollectionTablePreview {...props} />
    </PreviewFrame>,
    fixtureText,
  );
}
