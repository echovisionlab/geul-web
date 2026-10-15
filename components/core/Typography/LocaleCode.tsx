import { forwardRef } from 'react';
import { presentationAttributes, type PresentationProps } from '../presentation-contract';
import { Text } from './Typography';
import { formatLocaleCode } from './locale-code';

export interface LocaleCodeProps extends Omit<PresentationProps, 'children' | 'dir'> {
  code: string;
  size?: never;
  weight?: never;
  tone?: never;
  font?: never;
  casing?: never;
  dir?: never;
  children?: never;
}

/** A language code is secondary metadata; its UI notation is shared across the service. */
export const LocaleCode = forwardRef<HTMLElement, LocaleCodeProps>(({ code, ...props }, ref) => (
  <Text
    {...presentationAttributes(props)}
    ref={ref}
    as="span"
    size="xs"
    weight="regular"
    tone="secondary"
    nowrap
    dir="ltr"
  >
    {formatLocaleCode(code)}
  </Text>
));
LocaleCode.displayName = 'LocaleCode';
