'use client';

import { useMemo, type ComponentProps } from 'react';
import { IconLanguage } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { type NativeSelectProps } from '@mantine/core';
import { Button, type ButtonProps, type ControlEmphasis } from '@/components/core/Button';
import { Select, NativeSelect } from '@/components/core/Input';
import { DropdownMenu } from '@/components/core/DropdownMenu';
import {
  partitionTranslationLocaleOptions,
  useFormatTranslationLocaleOptionLabel,
  useTranslationLocaleSelectData,
  type TranslationLocaleSelectOption,
} from '@/features/translation/locale-option-format';

type BaseProps = {
  options: readonly TranslationLocaleSelectOption[];
  sourceLocale: string | null | undefined;
  value: string | null;
  onChange: (locale: string | null) => void;
  disabled?: boolean;
  fallbackLabel?: string | null;
};

type MenuControlProps = BaseProps & {
  variant: 'menu';
  withinPortal?: boolean;
  buttonEmphasis?: ControlEmphasis;
  buttonSize?: ButtonProps['size'];
  buttonAriaLabel?: string;
};

type SelectControlProps = BaseProps &
  Omit<ComponentProps<typeof Select>, 'data' | 'value' | 'onChange'> & {
    variant: 'select';
  };

type NativeSelectControlProps = BaseProps &
  Omit<NativeSelectProps, 'data' | 'value' | 'onChange'> & {
    variant: 'native-select';
  };

export type TranslationLocaleControlProps = MenuControlProps | SelectControlProps | NativeSelectControlProps;

export function TranslationLocaleControl(props: TranslationLocaleControlProps) {
  const t = useTranslations('translationPanel.activeEditLocale');
  const tCommonEntities = useTranslations('common.entities');
  const tCommonLabels = useTranslations('common.labels');
  const formatOptionLabel = useFormatTranslationLocaleOptionLabel();
  const formattedOptions = useTranslationLocaleSelectData(props.options, props.sourceLocale);
  const { sourceOption, translationOptions } = useMemo(
    () => partitionTranslationLocaleOptions(props.options, props.sourceLocale),
    [props.options, props.sourceLocale],
  );
  const groupedOptions = useMemo(() => {
    const groups: Array<{ group: string; items: Array<{ value: string; label: string }> }> = [];

    if (sourceOption) {
      groups.push({
        group: tCommonLabels('source'),
        items: [
          {
            value: sourceOption.value,
            label: formatOptionLabel(sourceOption, props.sourceLocale),
          },
        ],
      });
    }

    if (translationOptions.length > 0) {
      groups.push({
        group: tCommonEntities('translations'),
        items: translationOptions.map((option) => ({
          value: option.value,
          label: formatOptionLabel(option, props.sourceLocale),
        })),
      });
    }

    return groups.length > 0 ? groups : formattedOptions;
  }, [
    formatOptionLabel,
    formattedOptions,
    props.sourceLocale,
    sourceOption,
    tCommonEntities,
    tCommonLabels,
    translationOptions,
  ]);

  if (props.options.length === 0) {
    return null;
  }

  const activeOption = props.value ? props.options.find((option) => option.value === props.value) : undefined;
  const resolvedFallbackOption =
    props.value && props.fallbackLabel
      ? {
          value: props.value,
          label: props.fallbackLabel,
        }
      : undefined;
  const buttonLabel =
    (activeOption
      ? formatOptionLabel(activeOption, props.sourceLocale)
      : resolvedFallbackOption
        ? formatOptionLabel(resolvedFallbackOption, props.sourceLocale)
        : null) ??
    props.fallbackLabel ??
    t('loading');

  switch (props.variant) {
    case 'menu': {
      const {
        sourceLocale,
        value,
        onChange,
        disabled = false,
        withinPortal = true,
        buttonEmphasis = 'medium',
        buttonSize = 'xs',
        buttonAriaLabel,
      } = props;

      return (
        <DropdownMenu size="wide" placement="bottom-end" portal={withinPortal}>
          <DropdownMenu.Target>
            <Button
              size={buttonSize}
              tone="neutral"
              emphasis={buttonEmphasis}
              leftSection={<IconLanguage size={14} />}
              disabled={disabled}
              aria-label={buttonAriaLabel ?? t('ariaLabel', { locale: buttonLabel })}
            >
              {buttonLabel}
            </Button>
          </DropdownMenu.Target>
          <DropdownMenu.Dropdown>
            {sourceOption ? (
              <>
                <DropdownMenu.Label>{tCommonLabels('source')}</DropdownMenu.Label>
                <DropdownMenu.Item
                  key={sourceOption.value}
                  onClick={() => onChange(sourceOption.value)}
                  selected={value === sourceOption.value}
                >
                  {formatOptionLabel(sourceOption, sourceLocale)}
                </DropdownMenu.Item>
              </>
            ) : null}
            {translationOptions.length > 0 ? (
              <>
                <DropdownMenu.Label>{tCommonEntities('translations')}</DropdownMenu.Label>
                {translationOptions.map((option) => (
                  <DropdownMenu.Item
                    key={option.value}
                    onClick={() => onChange(option.value)}
                    selected={value === option.value}
                  >
                    {formatOptionLabel(option, sourceLocale)}
                  </DropdownMenu.Item>
                ))}
              </>
            ) : null}
          </DropdownMenu.Dropdown>
        </DropdownMenu>
      );
    }
    case 'select': {
      const { options: _options, sourceLocale: _sourceLocale, value, onChange, ...rest } = props;

      return <Select {...rest} data={groupedOptions} value={value} onChange={(locale) => onChange(locale)} />;
    }
    case 'native-select': {
      const { options: _options, sourceLocale: _sourceLocale, value, onChange, ...rest } = props;

      return (
        <NativeSelect
          {...rest}
          data={groupedOptions}
          value={value ?? ''}
          onChange={(event) => onChange(event.currentTarget.value || null)}
        />
      );
    }
  }
}
