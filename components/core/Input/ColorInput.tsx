import { forwardRef } from 'react';
import { ColorInput as MantineColorInput, type ColorInputProps as MantineColorInputProps } from '@mantine/core';
import { useCoreInputClassNames } from './useCoreInputClassNames';

export interface ColorInputProps extends MantineColorInputProps {
  animate?: boolean;
}

export const ColorInput = forwardRef<HTMLInputElement, ColorInputProps>(
  ({ animate = true, classNames, ...props }, ref) => {
    const mergedClassNames = useCoreInputClassNames(classNames, animate);

    return <MantineColorInput ref={ref} classNames={mergedClassNames} {...props} />;
  },
);

ColorInput.displayName = 'ColorInput';
