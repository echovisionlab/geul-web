'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Radio, RadioGroup } from 'react-aria-components';
import { inputAttributes, type InputBaseProps } from './input-contract';
import classes from './Input.module.css';
import { useCoreInputLabels } from './input-labels';
import { InputHelp, inputState, useToolbarInputPresentation } from './InputParts';
import { AnchoredTooltip } from '../Tooltip/Tooltip';
/** A visible text option. `accessibleLabel` names a non-text label such as a glyph. */
export interface SegmentedControlTextOption {
  value: string;
  label: ReactNode;
  accessibleLabel?: string;
  disabled?: boolean;
  icon?: never;
}
/**
 * An icon-only option. Core sizes the glyph, names the radio with `accessibleLabel`
 * and shows the same text as its hover hint.
 */
export interface SegmentedControlIconOption {
  value: string;
  icon: ReactNode;
  accessibleLabel: string;
  disabled?: boolean;
  label?: never;
}
export type SegmentedControlOption = string | SegmentedControlTextOption | SegmentedControlIconOption;
export interface SegmentedControlProps extends InputBaseProps {
  data: readonly SegmentedControlOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  fullWidth?: boolean;
  orientation?: 'horizontal' | 'vertical';
}
export function SegmentedControl(props: SegmentedControlProps) {
  const presentation = useToolbarInputPresentation(props);
  const labels = useCoreInputLabels();
  const hasHelp = Boolean(props.description || (props.error && typeof props.error !== 'boolean'));
  const options = props.data.map((item) => {
    const option: SegmentedControlTextOption | SegmentedControlIconOption =
      typeof item === 'string' ? { value: item, label: item } : item;
    const iconOnly = option.icon !== undefined;
    if (iconOnly && !option.accessibleLabel?.trim()) {
      throw new TypeError('Core SegmentedControl icon options require a nonempty accessibleLabel');
    }
    return (
      <Radio
        key={option.value}
        value={option.value}
        aria-label={option.accessibleLabel}
        aria-describedby={props['aria-describedby']}
        isDisabled={option.disabled}
        className={classes.segment}
        data-geul-segment-kind={iconOnly ? 'icon' : 'text'}
      >
        {iconOnly
          ? ({ isHovered, isFocusVisible }) => (
              <SegmentIcon
                icon={option.icon}
                label={option.accessibleLabel!}
                hovered={isHovered}
                focusVisible={isFocusVisible}
              />
            )
          : option.label}
      </Radio>
    );
  });
  return (
    <RadioGroup
      {...inputAttributes(props)}
      {...inputState(props)}
      id={props.id}
      className={hasHelp ? classes.root : classes.segments}
      data-geul-input
      data-geul-input-density={presentation.density}
      data-geul-input-grow={props.grow || undefined}
      data-geul-input-size={presentation.size ?? 'sm'}
      data-geul-input-full={props.fullWidth || undefined}
      aria-label={typeof props.label === 'string' ? props.label : (props['aria-label'] ?? labels.options)}
      value={props.value}
      defaultValue={props.defaultValue ?? (typeof props.data[0] === 'string' ? props.data[0] : props.data[0]?.value)}
      onChange={props.onChange}
      orientation={props.orientation}
      data-geul-input-orientation={props.orientation}
    >
      {({ isDisabled }) =>
        hasHelp ? (
          <>
            <div
              className={classes.segments}
              data-geul-input-full={props.fullWidth || undefined}
              data-geul-input-orientation={props.orientation}
              data-disabled={isDisabled || undefined}
            >
              {options}
            </div>
            <InputHelp {...props} />
          </>
        ) : (
          options
        )
      }
    </RadioGroup>
  );
}

/** Matches Core Tooltip's default hover delay; keyboard focus shows the hint immediately. */
const segmentHintDelay = 500;
/** The radio owns hover/focus, so the hint anchors to the glyph instead of adding a trigger wrapper. */
function SegmentIcon({
  icon,
  label,
  hovered,
  focusVisible,
}: {
  icon: ReactNode;
  label: string;
  hovered: boolean;
  focusVisible: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [hoverElapsed, setHoverElapsed] = useState(false);
  useEffect(() => {
    if (!hovered) {
      return undefined;
    }
    const timer = window.setTimeout(() => setHoverElapsed(true), segmentHintDelay);
    return () => {
      window.clearTimeout(timer);
      setHoverElapsed(false);
    };
  }, [hovered]);
  return (
    <>
      <span ref={ref} className={classes.segmentIcon} aria-hidden>
        {icon}
      </span>
      <AnchoredTooltip triggerRef={ref} isOpen={(hovered && hoverElapsed) || focusVisible} label={label} withArrow />
    </>
  );
}
