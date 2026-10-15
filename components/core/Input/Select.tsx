'use client';

import { forwardRef, useRef, useState, type ReactNode } from 'react';
import {
  Button,
  ComboBox,
  Group,
  Input,
  ListBox,
  ListBoxItem,
  ListBoxSection,
  Header,
  Popover,
} from 'react-aria-components';
import {
  useToolbarInputPresentation,
  InputHelp,
  InputLabel,
  inputPresentation,
  inputPopoverPresentation,
  inputState,
} from './InputParts';
import {
  inputAttributes,
  flattenOptions,
  type InputBaseProps,
  type InputOptions,
  type InputOption,
} from './input-contract';
import classes from './Input.module.css';
import { useCoreInputLabels } from './input-labels';
import { ComboboxOpenBridge } from './ComboboxOpenBridge';
import { InputClearGlyph, InputOpenGlyph } from './InputGlyphs';
export interface SelectProps extends InputBaseProps {
  width?: 'fill' | 'content';
  data?: InputOptions;
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (value: string | null, option: InputOption) => void;
  placeholder?: string;
  searchable?: boolean;
  getSearchText?: (option: InputOption) => string;
  clearable?: boolean;
  /** Names the clear command for this field's effect, e.g. "Remove from series". Defaults to the shared clear label. */
  clearLabel?: string;
  allowDeselect?: boolean;
  nothingFoundMessage?: ReactNode;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  dropdownOpened?: boolean;
  defaultDropdownOpened?: boolean;
  onDropdownOpen?: () => void;
  onDropdownClose?: () => void;
  renderOption?: (input: { option: InputOption; checked: boolean }) => ReactNode;
}
export const Select = forwardRef<HTMLInputElement, SelectProps>((props, ref) => {
  const presentation = useToolbarInputPresentation(props);
  const labels = useCoreInputLabels();
  const options = flattenOptions(props.data);
  const [query, setQuery] = useState('');
  const [opened, setOpened] = useState(props.defaultDropdownOpened ?? false);
  const [selected, setSelected] = useState(props.defaultValue ?? null);
  // React Aria opens a focused combobox whenever its input value changes. Only user typing may
  // do that; a caller updating `searchValue` (for example after a selection) is not an open request.
  const typedSinceOpenChange = useRef(false);
  const suppressedOpen = useRef(false);
  const value = props.value === undefined ? selected : props.value;
  const selectedLabel = options.find((option) => option.value === value)?.label;
  const search = props.searchValue ?? query;
  const visibleOptions =
    props.searchable && search && search !== selectedLabel
      ? options.filter((option) =>
          (props.getSearchText?.(option) ?? option.label).toLocaleLowerCase().includes(search.toLocaleLowerCase()),
        )
      : options;
  const update = (key: string | null) => {
    if (props.disabled || props.readOnly) {
      return;
    }
    setSelected(key);
    props.onChange?.(key, options.find((option) => option.value === key) ?? { value: key ?? '', label: '' });
  };
  if (props.width !== undefined && !['fill', 'content'].includes(props.width)) {
    throw new RangeError('Select width must be fill or content');
  }
  const field = (
    <ComboBox
      {...inputAttributes(props)}
      {...inputState(props)}
      {...inputPresentation(presentation)}
      items={visibleOptions}
      selectedKey={value}
      onSelectionChange={(key) =>
        update(key === null || (props.allowDeselect && String(key) === value) ? null : String(key))
      }
      inputValue={props.searchValue}
      onInputChange={(text) => {
        setQuery(text);
        props.onSearchChange?.(text);
      }}
      menuTrigger="focus"
      onOpenChange={(open, trigger) => {
        const typed = typedSinceOpenChange.current;
        typedSinceOpenChange.current = false;
        if (open && trigger === 'input' && !typed) {
          // The open-state bridge closes React Aria's state again; neither transition is reported.
          suppressedOpen.current = true;
          return;
        }
        if (!open && suppressedOpen.current) {
          suppressedOpen.current = false;
          return;
        }
        suppressedOpen.current = false;
        setOpened(open);
        if (open) {
          props.onDropdownOpen?.();
        } else {
          props.onDropdownClose?.();
        }
      }}
    >
      <ComboboxOpenBridge opened={props.disabled || props.readOnly ? false : (props.dropdownOpened ?? opened)} />
      <InputLabel {...props} />
      <Group className={classes.wrapper}>
        {props.leftSection ? <span className={classes.section}>{props.leftSection}</span> : null}
        <Input
          ref={ref}
          id={props.id}
          className={classes.input}
          placeholder={props.placeholder}
          readOnly={!props.searchable || props.readOnly}
          onFocus={props.onFocus}
          onBlur={props.onBlur}
          onKeyDown={props.onKeyDown}
          onKeyUp={props.onKeyUp}
          onChange={() => {
            typedSinceOpenChange.current = true;
          }}
          onClick={props.onClick}
          onCompositionStart={props.onCompositionStart}
          onCompositionEnd={props.onCompositionEnd}
        />
        {props.clearable && value ? (
          <Button
            slot={null}
            className={classes.accessory}
            aria-label={props.clearLabel ?? labels.clear}
            onPress={() => update(null)}
            isDisabled={props.disabled || props.readOnly}
          >
            <InputClearGlyph />
          </Button>
        ) : null}
        <Button className={classes.accessory}>{props.rightSection ?? <InputOpenGlyph />}</Button>
      </Group>
      <Popover {...inputPopoverPresentation(presentation)}>
        <ListBox className={classes.list} renderEmptyState={() => props.nothingFoundMessage ?? null}>
          {(props.data ?? []).flatMap((entry, index) => {
            const render = (option: InputOption) => (
              <ListBoxItem
                key={option.value}
                id={option.value}
                textValue={option.label}
                isDisabled={option.disabled}
                className={classes.option}
              >
                {props.renderOption?.({ option, checked: option.value === value }) ?? option.label}
              </ListBoxItem>
            );
            if (typeof entry === 'object' && 'group' in entry) {
              const items = flattenOptions(entry.items).filter((option) =>
                visibleOptions.some((item) => item.value === option.value),
              );
              return items.length
                ? [
                    <ListBoxSection key={`group-${index}`}>
                      <Header className={classes.optionGroup}>{entry.group}</Header>
                      {items.map(render)}
                    </ListBoxSection>,
                  ]
                : [];
            }
            const option = typeof entry === 'string' ? { value: entry, label: entry } : entry;
            return visibleOptions.some((item) => item.value === option.value) ? [render(option)] : [];
          })}
        </ListBox>
      </Popover>
      <InputHelp {...props} />
    </ComboBox>
  );
  if (props.width !== 'content') {
    return field;
  }
  return (
    <div
      className={classes.contentWidth}
      data-geul-input-size={presentation.size ?? 'sm'}
      data-geul-select-clearable={Boolean(props.clearable && value) || undefined}
    >
      <span className={classes.contentWidthSizer} aria-hidden="true">
        {props.label ? <span data-label>{props.label}</span> : null}
        {options.map((option) => (
          <span key={option.value}>{option.label}</span>
        ))}
        {props.placeholder ? <span>{props.placeholder}</span> : null}
      </span>
      {field}
    </div>
  );
});
Select.displayName = 'Select';
