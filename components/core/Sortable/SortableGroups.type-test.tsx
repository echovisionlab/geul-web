import { SortableGroups } from './SortableGroups';

const shared = {
  groups: [{ id: 'step-1', name: 'Details', items: [{ id: 'field-1', label: 'Name' }] }],
  onGroupsChange: () => {},
  renderGroup: () => null,
  renderItem: () => null,
};
type NamedGroup = (typeof shared.groups)[number];
type NamedItem = NamedGroup['items'][number];
export const named = (
  <SortableGroups<NamedGroup, NamedItem>
    {...shared}
    getGroupLabel={(group) => group.name}
    getItemLabel={(item) => item.label}
  />
);
// @ts-expect-error Generated internal identifiers cannot substitute for readable group and item names.
export const unnamed = <SortableGroups {...shared} />;
// @ts-expect-error Both group and item labels are necessary for cross-group destinations.
export const unnamedItem = <SortableGroups {...shared} getGroupLabel={(group) => group.name} />;
