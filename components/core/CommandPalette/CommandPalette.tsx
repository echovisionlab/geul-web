'use client';
import { SupportingText } from '../Typography';
import type { ClosedVisualProps } from '../visual-contract';
import { createContext, useContext, type ReactNode } from 'react';
import { Autocomplete, SearchField, Input, Menu, MenuItem } from 'react-aria-components';
import { IconSearch } from '@tabler/icons-react';
import { ContentModal } from '../Modal';

import { useNavigationClick } from '../Navigation/navigation-events';
import classes from './CommandPalette.module.css';
const CloseContext = createContext<() => void>(() => {});
export interface CommandPaletteProps extends ClosedVisualProps {
  opened: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  placeholder: string;
  query: string;
  onQueryChange: (query: string) => void;
  children: ReactNode;
}
/** React Aria owns virtual focus: typing and Arrow/Enter navigation share the search input. */
export function CommandPalette({
  opened,
  onClose,
  title,
  closeLabel,
  placeholder,
  query,
  onQueryChange,
  children,
}: CommandPaletteProps) {
  return (
    <ContentModal opened={opened} onClose={onClose} title={title} closeLabel={closeLabel} size="large">
      <CloseContext.Provider value={onClose}>
        <Autocomplete inputValue={query} onInputChange={onQueryChange}>
          <SearchField className={classes.search} aria-label={placeholder}>
            <IconSearch size="1em" aria-hidden />
            <Input className={classes.input} placeholder={placeholder} autoFocus />
          </SearchField>
          {children}
        </Autocomplete>
      </CloseContext.Provider>
    </ContentModal>
  );
}
export interface CommandPaletteItem {
  id: string;
  label: string;
  href: string;
  icon?: ReactNode;
}
export interface CommandPaletteResultsProps extends ClosedVisualProps {
  items: readonly CommandPaletteItem[];
  label: string;
  emptyLabel: string;
  loading?: boolean;
}
function Result({ item }: { item: CommandPaletteItem }) {
  const navigate = useNavigationClick({ href: item.href });
  return (
    <MenuItem id={item.id} href={item.href} textValue={item.label} className={classes.item} onClick={navigate}>
      {item.icon ? (
        <span className={classes.icon} aria-hidden>
          {item.icon}
        </span>
      ) : null}
      <span className={classes.label}>{item.label}</span>
    </MenuItem>
  );
}
export function CommandPaletteResults({ items, label, emptyLabel, loading = false }: CommandPaletteResultsProps) {
  const close = useContext(CloseContext);
  return (
    <Menu
      onClose={close}
      className={classes.results}
      aria-label={label}
      aria-busy={loading || undefined}
      items={items}
      renderEmptyState={() => <SupportingText tone="muted">{emptyLabel}</SupportingText>}
    >
      {(item) => <Result item={item} />}
    </Menu>
  );
}
