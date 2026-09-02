import { forwardRef } from 'react';
import { TagsInput as MantineTagsInput, type TagsInputProps as MantineTagsInputProps } from '@mantine/core';
import { useCoreInputClassNames } from './useCoreInputClassNames';

export interface TagsInputProps extends MantineTagsInputProps {
  animate?: boolean;
}

export const TagsInput = forwardRef<HTMLInputElement, TagsInputProps>(
  ({ animate = true, classNames, ...props }, ref) => {
    const mergedClassNames = useCoreInputClassNames(classNames, animate);

    return <MantineTagsInput ref={ref} classNames={mergedClassNames} {...props} />;
  },
);

TagsInput.displayName = 'TagsInput';
