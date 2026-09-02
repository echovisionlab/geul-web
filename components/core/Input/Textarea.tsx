import { forwardRef } from 'react';
import { Textarea as MantineTextarea, type TextareaProps as MantineTextareaProps } from '@mantine/core';
import { useCoreInputClassNames } from './useCoreInputClassNames';

export interface TextareaProps extends MantineTextareaProps {
  animate?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ animate = true, classNames, ...props }, ref) => {
    const mergedClassNames = useCoreInputClassNames(classNames, animate);

    return <MantineTextarea ref={ref} classNames={mergedClassNames} {...props} />;
  },
);

Textarea.displayName = 'Textarea';
