'use client';

import { forwardRef, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  Button,
  ComboBox,
  ComboBoxValue,
  Group,
  Input,
  InputContext,
  useSlottedContext,
  type InputProps,
  ListBox,
  ListBoxItem,
  Popover,
  Tag,
  TagGroup,
  TagList,
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
import { ComboboxOpenBridge } from './ComboboxOpenBridge';
import classes from './Input.module.css';
import { useCoreInputLabels } from './input-labels';
import { InputClearGlyph, InputOpenGlyph } from './InputGlyphs';

export interface MultiSelectProps extends InputBaseProps {
  data?: InputOptions;
  value?: string[];
  defaultValue?: string[];
  onChange?: (value: string[]) => void;
  placeholder?: string;
  searchable?: boolean;
  clearable?: boolean;
  nothingFoundMessage?: ReactNode;
  withPillsReorder?: boolean;
  maxValues?: number;
  hidePickedOptions?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  dropdownOpened?: boolean;
  defaultDropdownOpened?: boolean;
  onDropdownOpen?: () => void;
  onDropdownClose?: () => void;
  collapseSelectedValuesToOneLine?: boolean;
  renderOption?: (input: { option: InputOption; checked: boolean }) => ReactNode;
  getCollapsedSummaryLabel?: (hiddenValueCount: number) => string;
}
export const MultiSelect = forwardRef<HTMLInputElement, MultiSelectProps>((props, ref) => {
  const presentation = useToolbarInputPresentation(props);
  const labels = useCoreInputLabels();
  const [uncontrolled, setValue] = useState(props.defaultValue ?? []);
  const [opened, setOpened] = useState(props.defaultDropdownOpened ?? false);
  const [dragValue, setDragValue] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [visible, setVisible] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const values = props.value ?? uncontrolled;
  const currentSearch = props.searchValue ?? search;
  const options = flattenOptions(props.data);
  const currentOpen = props.dropdownOpened ?? opened;
  const update = (next: string[]) => {
    if (props.readOnly || props.disabled) {
      return;
    }
    setValue(next);
    props.onChange?.(next);
  };
  const move = (from: number, to: number) => {
    if (
      !props.withPillsReorder ||
      props.disabled ||
      props.readOnly ||
      from < 0 ||
      to < 0 ||
      from >= values.length ||
      to >= values.length ||
      from === to
    ) {
      return;
    }
    const next = [...values];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    update(next);
  };
  const presentationKey = values
    .map((value) => `${value}:${options.find((item) => item.value === value)?.label ?? value}`)
    .join('|');
  useLayoutEffect(() => {
    if (!props.collapseSelectedValuesToOneLine || currentOpen) {
      setVisible(null);
      return;
    }
    const measure = () => {
      const list = listRef.current;
      const source = measureRef.current;
      if (!list || !source) {
        return;
      }
      const pills = Array.from(source.querySelectorAll<HTMLElement>('[data-core-multiselect-selected-pill]'));
      const summary = source.querySelector<HTMLElement>('[data-core-multiselect-summary-measure]');
      const input = list.querySelector<HTMLInputElement>('input');
      const reserve = props.searchable && input ? input.getBoundingClientRect().width || input.offsetWidth : 0;
      const width = Math.max(0, (list.getBoundingClientRect().width || list.offsetWidth) - reserve);
      if (!width) {
        setVisible(values.length);
        return;
      }
      const gap = Number.parseFloat(getComputedStyle(list).gap) || 0;
      const widths = pills.map((pill) => pill.getBoundingClientRect().width || pill.offsetWidth);
      const total = widths.reduce((a, b) => a + b, 0) + gap * Math.max(0, widths.length - 1);
      if (total <= width) {
        setVisible(values.length);
        return;
      }
      let used = summary?.getBoundingClientRect().width || summary?.offsetWidth || 1;
      let count = 0;
      for (const pillWidth of widths) {
        if (used + gap + pillWidth > width) {
          break;
        }
        used += gap + pillWidth;
        count++;
      }
      setVisible(count);
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    if (listRef.current) {
      observer?.observe(listRef.current);
    }
    return () => observer?.disconnect();
  }, [props.collapseSelectedValuesToOneLine, currentOpen, presentationKey, values.length, props.size, props.density]);
  const shownValues = visible === null ? values : values.slice(0, visible);
  const hiddenCount = values.length - shownValues.length;
  const tagLabel = (value: string) => options.find((item) => item.value === value)?.label ?? value;
  return (
    <ComboBox
      {...inputAttributes(props)}
      {...inputState(props)}
      {...inputPresentation(presentation)}
      selectionMode="multiple"
      value={values}
      onChange={(keys) => {
        const next = keys.map(String);
        if (!props.maxValues || next.length <= props.maxValues) {
          update(next);
        }
      }}
      items={options.filter(
        (item) =>
          (!props.hidePickedOptions || !values.includes(item.value)) &&
          (!props.searchable ||
            !currentSearch.trim() ||
            item.label.toLocaleLowerCase().includes(currentSearch.trim().toLocaleLowerCase())),
      )}
      inputValue={currentSearch}
      onInputChange={(text) => {
        setSearch(text);
        props.onSearchChange?.(text);
      }}
      menuTrigger="focus"
      allowsEmptyCollection
      onOpenChange={(open) => {
        setOpened(open);
        if (open) {
          props.onDropdownOpen?.();
        } else {
          props.onDropdownClose?.();
        }
      }}
    >
      <ComboboxOpenBridge opened={props.dropdownOpened ?? opened} />
      <InputLabel {...props} />
      <Group className={classes.wrapper}>
        <div
          ref={listRef}
          className={classes.valueList}
          data-core-multiselect-values
          onKeyDownCapture={(event) => {
            const pill = (event.target as HTMLElement).closest<HTMLElement>('[data-core-multiselect-visible-pill]');
            if (pill && event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
              event.preventDefault();
              const from = Number(pill.dataset.coreMultiselectSelectedPillIndex);
              move(from, from + (event.key === 'ArrowRight' ? 1 : -1));
            }
          }}
          onDragStartCapture={(event) => {
            const pill = (event.target as HTMLElement).closest<HTMLElement>('[data-core-multiselect-visible-pill]');
            if (pill) {
              setDragValue(values[Number(pill.dataset.coreMultiselectSelectedPillIndex)]);
            }
          }}
          onDragOverCapture={(event) => {
            if (dragValue !== null) {
              event.preventDefault();
            }
          }}
          onDropCapture={(event) => {
            const pill = (event.target as HTMLElement).closest<HTMLElement>('[data-core-multiselect-visible-pill]');
            if (pill && dragValue !== null) {
              event.preventDefault();
              move(values.indexOf(dragValue), Number(pill.dataset.coreMultiselectSelectedPillIndex));
            }
            setDragValue(null);
          }}
        >
          <ComboBoxValue className={classes.tags} inert={currentOpen || undefined}>
            {() =>
              shownValues.length ? (
                <TagGroup
                  className={classes.tags}
                  aria-label={typeof props.label === 'string' ? props.label : (props['aria-label'] ?? labels.options)}
                  onRemove={(keys) => update(values.filter((value) => !keys.has(value)))}
                >
                  <TagList items={shownValues.map((value) => ({ id: value, label: tagLabel(value) }))}>
                    {(item) => (
                      <Tag
                        id={item.id}
                        textValue={item.label}
                        className={classes.tag}
                        data-core-multiselect-visible-pill
                        data-core-multiselect-selected-pill-index={values.indexOf(item.id)}
                        aria-keyshortcuts={props.withPillsReorder ? 'Alt+ArrowLeft Alt+ArrowRight' : undefined}
                      >
                        <span draggable={props.withPillsReorder && !props.disabled && !props.readOnly}>
                          {item.label}
                        </span>
                        {!props.readOnly && !props.disabled ? (
                          <Button slot="remove" className={classes.tagRemove}>
                            <InputClearGlyph />
                          </Button>
                        ) : null}
                      </Tag>
                    )}
                  </TagList>
                </TagGroup>
              ) : null
            }
          </ComboBoxValue>
          {hiddenCount ? (
            <span
              className={classes.tag}
              data-core-multiselect-summary
              aria-label={props.getCollapsedSummaryLabel?.(hiddenCount) ?? `+${hiddenCount}`}
            >
              +{hiddenCount}
            </span>
          ) : null}
          <MultiSelectInput
            ref={ref}
            id={props.id}
            aria-describedby={props['aria-describedby']}
            data-type={props.searchable ? 'visible' : 'hidden'}
            className={classes.input}
            placeholder={values.length ? '' : props.placeholder}
            readOnly={!props.searchable || props.readOnly}
            onKeyDown={(event) => {
              if (event.key === 'Backspace' && !currentSearch && values.length) {
                update(values.slice(0, -1));
              }
              props.onKeyDown?.(event);
            }}
          />
        </div>
        {props.clearable && values.length ? (
          <Button
            slot={null}
            className={classes.accessory}
            aria-label={labels.clear}
            onPress={() => update([])}
            isDisabled={props.disabled || props.readOnly}
          >
            <InputClearGlyph />
          </Button>
        ) : null}
        <Button className={classes.accessory}>
          <InputOpenGlyph />
        </Button>
      </Group>
      <div ref={measureRef} className={classes.measure} aria-hidden>
        {values.map((value, index) => (
          <span
            key={value}
            className={classes.tag}
            data-core-multiselect-selected-pill
            data-core-multiselect-selected-pill-index={index}
          >
            {tagLabel(value)}
            <InputClearGlyph />
          </span>
        ))}
        <span className={classes.tag} data-core-multiselect-summary-measure>
          +{values.length}
        </span>
      </div>
      <Popover {...inputPopoverPresentation(presentation)}>
        <ListBox<InputOption> className={classes.list} renderEmptyState={() => props.nothingFoundMessage ?? null}>
          {(item) => (
            <ListBoxItem id={item.value} textValue={item.label} isDisabled={item.disabled} className={classes.option}>
              {props.renderOption?.({ option: item, checked: values.includes(item.value) }) ?? item.label}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
      <InputHelp {...props} />
    </ComboBox>
  );
});
MultiSelect.displayName = 'MultiSelect';

/** Multi-selection adds its own selected-value description. Keep external field
 * guidance alongside it rather than replacing either relationship. */
const MultiSelectInput = forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  const context = useSlottedContext(InputContext);
  const describedBy =
    [
      ...new Set(
        [context?.['aria-describedby'], props['aria-describedby']]
          .filter(Boolean)
          .flatMap((value) => value?.split(/\s+/) ?? []),
      ),
    ].join(' ') || undefined;
  return <Input {...props} ref={ref} aria-describedby={describedBy} />;
});
MultiSelectInput.displayName = 'MultiSelectInput';
