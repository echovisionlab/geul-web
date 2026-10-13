import type { ClosedVisualProps } from '../visual-contract';
import classes from './NativeRange.module.css';

export interface NativeRangePresentation extends ClosedVisualProps {
  min?: number;
  max?: number;
  step?: number;
  value: number;
  label: string;
  valueText?: string;
  disabled?: boolean;
}

/** Native range controls share browser keyboard behavior and Core sizing, focus and disabled states. */
export function applyNativeRange(
  element: HTMLInputElement,
  { min = 0, max = 100, step = 1, value, label, valueText, disabled = false }: NativeRangePresentation,
) {
  if (![min, max, step].every(Number.isFinite) || max <= min || step <= 0) {
    throw new RangeError('Core native range requires finite min < max and positive step');
  }
  if (!element.classList.contains(classes.range)) {
    element.classList.add(classes.range);
  }
  element.type = 'range';
  element.min = String(min);
  element.max = String(max);
  element.step = String(step);
  element.disabled = disabled;
  element.setAttribute('aria-label', label);
  if (valueText === undefined) {
    element.removeAttribute('aria-valuetext');
  } else {
    element.setAttribute('aria-valuetext', valueText);
  }
  updateNativeRangeValue(element, value);
  return element;
}

export function updateNativeRangeValue(element: HTMLInputElement, value: number) {
  const min = Number(element.min || 0);
  const max = Number(element.max || 100);
  const bounded = Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
  element.value = String(bounded);
}
