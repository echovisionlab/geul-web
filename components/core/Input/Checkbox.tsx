import { forwardRef } from 'react';
import {
  createPolymorphicComponent,
  Checkbox as MantineCheckbox,
  type CheckboxProps as MantineCheckboxProps,
} from '@mantine/core';

export interface CheckboxProps extends MantineCheckboxProps {}

function CheckboxInner({ radius = 0, ...props }: CheckboxProps, ref: React.ForwardedRef<HTMLInputElement>) {
  return <MantineCheckbox ref={ref} radius={radius} {...props} />;
}

const CheckboxBase = forwardRef<HTMLInputElement, CheckboxProps>(CheckboxInner);

CheckboxBase.displayName = 'Checkbox';

export const Checkbox = Object.assign(createPolymorphicComponent<'input', CheckboxProps>(CheckboxBase), {
  Group: MantineCheckbox.Group,
});
