'use client';
import type { ClosedVisualProps } from '../visual-contract';
import type { ReactNode } from 'react';
import { ComboBox, Group, Input, Label, ListBox, ListBoxItem, Popover } from 'react-aria-components';
import { ComboboxOpenBridge } from './ComboboxOpenBridge';
import type { InputComboboxController } from './useInputCombobox';
import type { InputSize } from './input-contract';
import classes from './Input.module.css';
import { inputPopoverPresentation } from './InputParts';
import { SearchGlyph } from './SearchInput';
import { InputValidationGlyph } from './InputGlyphs';
export interface SearchComboboxViewProps<T> extends ClosedVisualProps {
  combobox: InputComboboxController;
  search: string;
  onSearchChange: (value: string) => void;
  placeholder: string;
  label?: ReactNode;
  leftSection?: ReactNode;
  /** Core's leading search glyph for free-text lookup. Do not combine with leftSection. */
  leadingGlyph?: 'search';
  items: T[];
  isLoading?: boolean;
  minQueryLength?: number;
  debouncedSearch: string;
  onSelect: (id: string) => void;
  renderItem: (item: T) => ReactNode;
  getItemId: (item: T) => string;
  getItemText: (item: T) => string;
  inputId?: string;
  emptyMessage?: string;
  minimumQueryMessage: string;
  noResultsMessage: string;
  size?: InputSize;
  disabled?: boolean;
  grow?: boolean;
  /** Input validation state. Query failures and retry UI belong to the caller. */
  error?: ReactNode;
}
export function SearchComboboxView<T>(props: SearchComboboxViewProps<T>) {
  if (props.leadingGlyph !== undefined && (props.leadingGlyph !== 'search' || props.leftSection !== undefined)) {
    throw new TypeError(
      'SearchComboboxView leadingGlyph accepts only "search" and cannot be combined with leftSection',
    );
  }
  const items = props.items.map((item) => ({ id: props.getItemId(item), item }));
  return (
    <ComboBox
      className={classes.root}
      data-geul-input
      data-geul-input-grow={props.grow || undefined}
      data-geul-input-size={props.size ?? 'xs'}
      items={items}
      isDisabled={props.disabled}
      isInvalid={Boolean(props.error)}
      aria-label={props.label ? undefined : props.placeholder}
      inputValue={props.search}
      onInputChange={(value) => {
        props.onSearchChange(value);
        props.combobox.openDropdown();
      }}
      onSelectionChange={(key) => {
        if (key !== null) {
          props.onSelect(String(key));
          props.combobox.closeDropdown();
        }
      }}
      selectedKey={null}
      allowsCustomValue
      allowsEmptyCollection
      menuTrigger="focus"
      onOpenChange={(open) => {
        if (open) {
          props.combobox.openDropdown();
        } else {
          props.combobox.closeDropdown();
        }
      }}
    >
      <ComboboxOpenBridge opened={props.combobox.dropdownOpened} />
      {props.label ? <Label className={classes.label}>{props.label}</Label> : null}
      <Group className={classes.wrapper}>
        {props.leadingGlyph === 'search' ? (
          <span className={classes.section}>
            <SearchGlyph />
          </span>
        ) : props.leftSection ? (
          <span className={classes.section}>{props.leftSection}</span>
        ) : null}
        <Input
          id={props.inputId}
          className={classes.input}
          data-search-combobox-target
          placeholder={props.placeholder}
          aria-busy={props.isLoading || undefined}
        />
        {props.isLoading ? (
          <span className={classes.section} aria-hidden>
            <InputValidationGlyph status="checking" />
          </span>
        ) : null}
      </Group>
      <Popover {...inputPopoverPresentation({ size: props.size ?? 'xs' })} data-search-combobox-dropdown>
        <ListBox<{ id: string; item: T }>
          className={classes.list}
          renderEmptyState={() =>
            props.isLoading
              ? null
              : props.debouncedSearch.length < (props.minQueryLength ?? 2)
                ? props.minimumQueryMessage
                : props.emptyMessage || props.noResultsMessage
          }
        >
          {(entry) => (
            <ListBoxItem
              id={entry.id}
              textValue={props.getItemText(entry.item)}
              aria-label={props.getItemText(entry.item)}
              className={classes.option}
            >
              {props.renderItem(entry.item)}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </ComboBox>
  );
}
