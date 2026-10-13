import type { EmojiPickerPanelProps } from './EmojiPicker';
const props: EmojiPickerPanelProps = {
  title: 'Emoji',
  searchPlaceholder: 'Search',
  noResults: 'No results',
  query: '',
  items: [],
  onQueryChange() {},
  onSelect() {},
  density: 'compact',
};
// @ts-expect-error density is a closed shared contract
const customDensity: EmojiPickerPanelProps = { ...props, density: 'tiny' };
// @ts-expect-error consumers cannot set grid styling
const customGrid: EmojiPickerPanelProps = { ...props, style: { height: 1000 } };
const visualVariable = { ...props, className: 'custom' };
// @ts-expect-error variable spreads cannot bypass Core ownership
const forbiddenVariable: EmojiPickerPanelProps = visualVariable;
void [customDensity, customGrid, forbiddenVariable];
