import { MultiSelect, type MultiSelectProps } from './MultiSelect';
import { MultiSelectComboboxView, type MultiSelectComboboxViewProps } from './MultiSelectComboboxView';

type Genre = { id: string; name: string; description: string };
const props: MultiSelectComboboxViewProps<Genre> = {
  label: 'Genres',
  placeholder: 'Select genres',
  emptyMessage: 'No genres available',
  notFoundMessage: 'No genres found',
  options: [],
  selectedItems: [],
  canEdit: true,
  canCreateNew: true,
  onSelect: (item) => item.description,
  onDeselect: (item) => item.description,
  onCreate: (name) => name.trim(),
  createOptionLabel: (name) => `Create "${name}"`,
  loadingLabel: 'Loading genres',
};

export const pendingStates = (
  <>
    <MultiSelect isLoading loadingLabel="Loading genres" data={['Ambient']} value={['Ambient']} />
    <MultiSelectComboboxView {...props} isLoading />
    <MultiSelectComboboxView {...props} isCreating />
    <MultiSelectComboboxView {...props} isCreating={false} />
    <MultiSelectComboboxView {...props} isLoading canEdit={false} />
  </>
);

export const nonTextStatus: MultiSelectProps = {
  // @ts-expect-error Pending copy is an accessible name, not visible markup.
  loadingLabel: <span>Loading</span>,
};
export const pendingStyleEscape: MultiSelectProps = {
  // @ts-expect-error Pending appearance remains owned by Core.
  styles: { input: { color: 'red' } },
};
