import { forwardRef } from 'react';
import { Text, type TextProps } from './Typography';

/** Product explanations, helper copy, empty states and passive status messages. */
export interface SupportingTextProps extends Omit<TextProps, 'size' | 'weight'> {
  size?: never;
  weight?: never;
}

export const SupportingText = forwardRef<HTMLElement, SupportingTextProps>(({ tone = 'secondary', ...props }, ref) => (
  <Text {...props} ref={ref} size="xs" weight="regular" tone={tone} />
));
SupportingText.displayName = 'SupportingText';
