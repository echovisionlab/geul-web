import { forwardRef } from 'react';
import { FileInput as MantineFileInput, type FileInputProps as MantineFileInputProps } from '@mantine/core';
import { useCoreInputClassNames } from './useCoreInputClassNames';

export interface FileInputProps extends MantineFileInputProps {
  animate?: boolean;
}

export const FileInput = forwardRef<HTMLButtonElement, FileInputProps>(
  ({ animate = true, classNames, ...props }, ref) => {
    const mergedClassNames = useCoreInputClassNames(classNames, animate);

    return <MantineFileInput ref={ref} classNames={mergedClassNames} {...props} />;
  },
);

FileInput.displayName = 'FileInput';
