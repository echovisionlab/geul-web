import { IconAlertCircle, IconCheck, IconX } from '@tabler/icons-react';
import { Loader } from '@mantine/core';
import { TextInput, type TextInputProps } from './TextInput';

export type TextValidationStatus = 'idle' | 'checking' | 'valid' | 'invalid' | 'error';

export interface ValidatingTextInputProps extends TextInputProps {
  status?: TextValidationStatus;
}

/** TextInput with an in-field validation indicator. Validation and persistence stay in Feature controllers. */
export function ValidatingTextInput({
  status = 'idle',
  rightSection,
  rightSectionWidth,
  styles,
  ...props
}: ValidatingTextInputProps) {
  const hasValidationStatus = status !== 'idle';
  const validationRightSection =
    status === 'checking' ? (
      <Loader size="xs" aria-hidden />
    ) : status === 'valid' ? (
      <IconCheck size={16} color="var(--mantine-color-green-6)" aria-hidden />
    ) : status === 'invalid' ? (
      <IconX size={16} color="var(--mantine-color-red-6)" aria-hidden />
    ) : status === 'error' ? (
      <IconAlertCircle size={16} color="var(--mantine-color-red-6)" aria-hidden />
    ) : (
      rightSection
    );
  const validationSectionWidth = rightSectionWidth ?? 36;
  const sectionWidthCss =
    typeof validationSectionWidth === 'number' ? `${validationSectionWidth}px` : validationSectionWidth;
  const validationStyles: TextInputProps['styles'] = hasValidationStatus
    ? typeof styles === 'function'
      ? (theme, inputProps, context) => {
          const resolved = styles(theme, inputProps, context);
          return {
            ...resolved,
            input: {
              ...resolved.input,
              paddingInlineEnd: `calc(${sectionWidthCss} + var(--mantine-spacing-xs))`,
            },
            section: { ...resolved.section, width: validationSectionWidth },
          };
        }
      : {
          ...styles,
          input: {
            ...styles?.input,
            paddingInlineEnd: `calc(${sectionWidthCss} + var(--mantine-spacing-xs))`,
          },
          section: { ...styles?.section, width: validationSectionWidth },
        }
    : styles;

  return (
    <TextInput
      {...props}
      rightSection={validationRightSection}
      rightSectionWidth={hasValidationStatus ? validationSectionWidth : rightSectionWidth}
      styles={validationStyles}
    />
  );
}
