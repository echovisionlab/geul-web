import {
  cloneElement,
  Fragment,
  forwardRef,
  isValidElement,
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from 'react';
import {
  getParsedComboboxData,
  MultiSelect as MantineMultiSelect,
  Pill,
  type ComboboxRenderPillInput,
  type MultiSelectProps as MantineMultiSelectProps,
} from '@mantine/core';
import { useIsomorphicEffect, useMergedRef } from '@mantine/hooks';
import { useCoreInputClassNames } from './useCoreInputClassNames';

export interface MultiSelectProps extends MantineMultiSelectProps {
  animate?: boolean;
  /**
   * Keeps selected values on one line while the dropdown is closed. Values that
   * do not fit are represented by a non-removable `+N` summary. Opening the
   * dropdown restores every selected value for editing.
   */
  collapseSelectedValuesToOneLine?: boolean;
  /** Accessible label used for the `+N` summary. */
  getCollapsedSummaryLabel?: (hiddenValueCount: number) => string;
}

interface PillMeasurements {
  presentationKey: string;
  summaryWidth: number;
  widths: number[];
}

const EMPTY_MEASUREMENTS: PillMeasurements = {
  presentationKey: '',
  summaryWidth: 0,
  widths: [],
};

function readElementWidth(element: Element) {
  const rectWidth = element.getBoundingClientRect().width;
  return rectWidth > 0 ? rectWidth : (element as HTMLElement).offsetWidth;
}

function readGap(element: HTMLElement) {
  const styles = window.getComputedStyle(element);
  const gap = Number.parseFloat(styles.columnGap || styles.gap);
  return Number.isFinite(gap) ? gap : 0;
}

function getSelectedPillsPresentationKey(data: MantineMultiSelectProps['data'], selectedValues: string[]) {
  const optionByValue = new Map<string, { disabled?: boolean; label: string }>();

  for (const item of getParsedComboboxData(data)) {
    const options = 'items' in item ? item.items : [item];
    for (const option of options) {
      optionByValue.set(String(option.value), {
        disabled: option.disabled,
        label: String(option.label),
      });
    }
  }

  return selectedValues
    .map((value) => {
      const option = optionByValue.get(value);
      const label = option?.label ?? value;
      return `${value.length}:${value}:${label.length}:${label}:${option?.disabled ? 1 : 0}`;
    })
    .join('|');
}

export const MultiSelect = forwardRef<HTMLInputElement, MultiSelectProps>(
  (
    {
      animate = true,
      classNames,
      collapseSelectedValuesToOneLine = false,
      data,
      defaultDropdownOpened,
      defaultValue,
      disabled,
      dropdownOpened,
      getCollapsedSummaryLabel = (hiddenValueCount) =>
        `${hiddenValueCount} more selected ${hiddenValueCount === 1 ? 'value' : 'values'}`,
      onChange,
      onDropdownClose,
      onDropdownOpen,
      readOnly,
      renderPill,
      unstyled,
      value,
      ...props
    },
    ref,
  ) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const mergedRef = useMergedRef(ref, inputRef);
    const measurementsRef = useRef<PillMeasurements>(EMPTY_MEASUREMENTS);
    const [uncontrolledValue, setUncontrolledValue] = useState<string[]>(defaultValue ?? []);
    const [uncontrolledDropdownOpen, setUncontrolledDropdownOpen] = useState(defaultDropdownOpened ?? false);
    const [visiblePillCount, setVisiblePillCount] = useState<number | null>(null);
    const isDropdownOpen = dropdownOpened ?? uncontrolledDropdownOpen;
    const selectedValues = value ?? uncontrolledValue;
    const selectedValuesKey = selectedValues.map((item) => `${item.length}:${item}`).join('|');
    const selectedPillsPresentationKey = useMemo(
      () => getSelectedPillsPresentationKey(data, selectedValues),
      [data, selectedValues],
    );

    const mergedClassNames = useCoreInputClassNames(classNames, animate);

    const updateVisiblePillCount = useCallback(() => {
      if (!collapseSelectedValuesToOneLine || isDropdownOpen) {
        return;
      }

      if (selectedValues.length === 0) {
        setVisiblePillCount(0);
        return;
      }

      const input = inputRef.current;
      const pillsList = input?.parentElement;
      if (!input || !pillsList) {
        return;
      }

      const pillsListWidth = readElementWidth(pillsList);
      if (pillsListWidth <= 0) {
        setVisiblePillCount(selectedValues.length);
        return;
      }

      const renderedPills = Array.from(
        pillsList.querySelectorAll<HTMLElement>('[data-core-multiselect-selected-pill]'),
      );
      const summaryMeasure =
        pillsList.querySelector<HTMLElement>('[data-core-multiselect-summary-measure]') ??
        pillsList.querySelector<HTMLElement>('[data-core-multiselect-summary]');

      let measurements = measurementsRef.current;
      if (renderedPills.length === selectedValues.length) {
        measurements = {
          presentationKey: selectedPillsPresentationKey,
          summaryWidth: summaryMeasure ? readElementWidth(summaryMeasure) : 0,
          widths: renderedPills.map(readElementWidth),
        };
        measurementsRef.current = measurements;
      } else if (measurements.presentationKey !== selectedPillsPresentationKey) {
        setVisiblePillCount(null);
        return;
      }

      if (measurements.widths.length !== selectedValues.length) {
        setVisiblePillCount(selectedValues.length);
        return;
      }

      const gap = readGap(pillsList);
      const inputStyles = window.getComputedStyle(input);
      const inputMinimumWidth = input.dataset.type === 'hidden' ? 0 : Number.parseFloat(inputStyles.minWidth);
      const reservedInputWidth =
        input.dataset.type === 'hidden'
          ? 0
          : Number.isFinite(inputMinimumWidth)
            ? inputMinimumWidth
            : readElementWidth(input);
      const availablePillWidth = Math.max(0, pillsListWidth - reservedInputWidth - (reservedInputWidth > 0 ? gap : 0));
      const fullWidth =
        measurements.widths.reduce((total, width) => total + width, 0) +
        gap * Math.max(0, measurements.widths.length - 1);

      if (fullWidth <= availablePillWidth) {
        setVisiblePillCount((current) => (current === selectedValues.length ? current : selectedValues.length));
        return;
      }

      const summaryWidth = measurements.summaryWidth || 1;
      let nextVisiblePillCount = 0;
      let occupiedWidth = summaryWidth;

      for (const pillWidth of measurements.widths) {
        const candidateWidth = occupiedWidth + gap + pillWidth;
        if (candidateWidth > availablePillWidth) {
          break;
        }

        occupiedWidth = candidateWidth;
        nextVisiblePillCount += 1;
      }

      setVisiblePillCount((current) => (current === nextVisiblePillCount ? current : nextVisiblePillCount));
    }, [collapseSelectedValuesToOneLine, isDropdownOpen, selectedPillsPresentationKey, selectedValues.length]);

    useIsomorphicEffect(() => {
      if (!isDropdownOpen) {
        setVisiblePillCount(null);
      }
    }, [isDropdownOpen]);

    useIsomorphicEffect(() => {
      if (!collapseSelectedValuesToOneLine || isDropdownOpen) {
        return;
      }

      setVisiblePillCount(null);
    }, [collapseSelectedValuesToOneLine, selectedPillsPresentationKey, selectedValuesKey]);

    useIsomorphicEffect(() => {
      updateVisiblePillCount();
    }, [updateVisiblePillCount, visiblePillCount]);

    useIsomorphicEffect(() => {
      if (!collapseSelectedValuesToOneLine || isDropdownOpen || !inputRef.current) {
        return;
      }

      const pillsList = inputRef.current.parentElement;
      if (!pillsList || typeof ResizeObserver === 'undefined') {
        return;
      }

      const observer = new ResizeObserver(() => {
        updateVisiblePillCount();
      });
      observer.observe(pillsList);
      pillsList
        .querySelectorAll<HTMLElement>('[data-core-multiselect-selected-pill]')
        .forEach((pill) => observer.observe(pill));

      return () => observer.disconnect();
    }, [collapseSelectedValuesToOneLine, isDropdownOpen, selectedValuesKey, updateVisiblePillCount, visiblePillCount]);

    const handleChange = useCallback(
      (nextValue: string[]) => {
        if (value === undefined) {
          setUncontrolledValue(nextValue);
        }
        onChange?.(nextValue);
      },
      [onChange, value],
    );

    const handleDropdownOpen = useCallback(() => {
      if (dropdownOpened === undefined) {
        setUncontrolledDropdownOpen(true);
      }
      setVisiblePillCount(null);
      onDropdownOpen?.();
    }, [dropdownOpened, onDropdownOpen]);

    const handleDropdownClose = useCallback(() => {
      if (dropdownOpened === undefined) {
        setUncontrolledDropdownOpen(false);
      }
      setVisiblePillCount(null);
      onDropdownClose?.();
    }, [dropdownOpened, onDropdownClose]);

    const shouldCollapse =
      collapseSelectedValuesToOneLine &&
      !isDropdownOpen &&
      visiblePillCount !== null &&
      visiblePillCount < selectedValues.length;

    const renderSelectedPill = useCallback(
      (pillProps: ComboboxRenderPillInput<string>) => {
        const pillValue = pillProps.value ?? '';
        const pillIndex = selectedValues.indexOf(pillValue);
        if (pillIndex === -1) {
          return renderPill?.(pillProps) ?? pillProps.option?.label ?? pillValue;
        }

        if (shouldCollapse && pillIndex > visiblePillCount) {
          return null;
        }

        if (shouldCollapse && pillIndex === visiblePillCount) {
          const hiddenValueCount = selectedValues.length - visiblePillCount;
          return (
            <span data-core-multiselect-summary style={{ display: 'inline-flex', flex: '0 0 auto' }}>
              <Pill aria-label={getCollapsedSummaryLabel(hiddenValueCount)}>+{hiddenValueCount}</Pill>
            </span>
          );
        }

        const measurementProps = {
          'data-core-multiselect-selected-pill': true,
          'data-core-multiselect-selected-pill-index': pillIndex,
        };
        let visibleContent: ReactElement;

        if (renderPill) {
          const customContent = renderPill(pillProps);
          visibleContent =
            isValidElement(customContent) && customContent.type !== Fragment ? (
              cloneElement(customContent as ReactElement<Record<string, unknown>>, measurementProps)
            ) : (
              <span
                {...measurementProps}
                style={{
                  display: 'inline-flex',
                  flex: '0 0 auto',
                  maxWidth: '100%',
                }}
              >
                {customContent}
              </span>
            );
        } else {
          visibleContent = (
            <Pill
              {...pillProps.reorderProps}
              {...measurementProps}
              disabled={disabled}
              onRemove={pillProps.onRemove}
              unstyled={unstyled}
              withRemoveButton={!readOnly && !pillProps.option?.disabled}
            >
              {pillProps.option?.label ?? pillValue}
            </Pill>
          );
        }

        if (pillIndex !== 0) {
          return visibleContent;
        }

        return (
          <>
            {visibleContent}
            <span
              aria-hidden
              data-core-multiselect-summary-measure
              style={{
                display: 'inline-flex',
                pointerEvents: 'none',
                position: 'absolute',
                visibility: 'hidden',
              }}
            >
              <Pill>+{selectedValues.length}</Pill>
            </span>
          </>
        );
      },
      [
        disabled,
        getCollapsedSummaryLabel,
        readOnly,
        renderPill,
        selectedValues,
        shouldCollapse,
        unstyled,
        visiblePillCount,
      ],
    );

    return (
      <MantineMultiSelect
        ref={mergedRef}
        classNames={mergedClassNames}
        data={data}
        defaultDropdownOpened={defaultDropdownOpened}
        defaultValue={defaultValue}
        disabled={disabled}
        dropdownOpened={dropdownOpened}
        onChange={handleChange}
        onDropdownClose={handleDropdownClose}
        onDropdownOpen={handleDropdownOpen}
        readOnly={readOnly}
        renderPill={collapseSelectedValuesToOneLine ? renderSelectedPill : renderPill}
        unstyled={unstyled}
        value={value}
        {...props}
      />
    );
  },
);

MultiSelect.displayName = 'MultiSelect';
