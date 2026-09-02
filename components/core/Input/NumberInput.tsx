import { forwardRef } from 'react';
import { NumberInput as MantineNumberInput, type NumberInputProps as MantineNumberInputProps } from '@mantine/core';
import { useCoreInputClassNames } from './useCoreInputClassNames';

export interface NumberInputProps extends MantineNumberInputProps {
  animate?: boolean;
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  ({ animate = true, classNames, ...props }, ref) => {
    const mergedClassNames = useCoreInputClassNames(classNames, animate);

    return <MantineNumberInput ref={ref} classNames={mergedClassNames} {...props} />;
  },
);

NumberInput.displayName = 'NumberInput';
