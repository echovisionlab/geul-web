import { forwardRef } from 'react';
import { Select as MantineSelect, type SelectProps as MantineSelectProps } from '@mantine/core';
import { useCoreInputClassNames } from './useCoreInputClassNames';

export interface SelectProps extends MantineSelectProps {
  animate?: boolean;
}

export const Select = forwardRef<HTMLInputElement, SelectProps>(({ animate = true, classNames, ...props }, ref) => {
  const mergedClassNames = useCoreInputClassNames(classNames, animate);

  return <MantineSelect ref={ref} classNames={mergedClassNames} {...props} />;
});

Select.displayName = 'Select';
