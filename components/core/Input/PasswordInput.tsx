import { forwardRef } from 'react';
import {
  PasswordInput as MantinePasswordInput,
  type PasswordInputProps as MantinePasswordInputProps,
} from '@mantine/core';
import { useCoreInputClassNames } from './useCoreInputClassNames';

export interface PasswordInputProps extends MantinePasswordInputProps {
  animate?: boolean;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ animate = true, classNames, ...props }, ref) => {
    const mergedClassNames = useCoreInputClassNames(classNames, animate);

    return <MantinePasswordInput ref={ref} classNames={mergedClassNames} {...props} />;
  },
);

PasswordInput.displayName = 'PasswordInput';
