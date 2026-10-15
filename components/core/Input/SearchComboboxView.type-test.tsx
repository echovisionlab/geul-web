import type { SearchComboboxViewProps } from './SearchComboboxView';
type Item = { id: string; name: string };
export const named: Pick<SearchComboboxViewProps<Item>, 'getItemId' | 'getItemText'> = {
  getItemId: (item) => item.id,
  getItemText: (item) => item.name,
};
// @ts-expect-error A stable option ID does not supply its readable text.
export const unnamed: Pick<SearchComboboxViewProps<Item>, 'getItemId' | 'getItemText'> = {
  getItemId: (item) => item.id,
};
