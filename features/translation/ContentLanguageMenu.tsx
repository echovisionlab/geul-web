'use client';

import Link from 'next/link';
import { IconLanguage } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { useMounted } from '@mantine/hooks';
import { Button } from '@/components/core/Button';
import { DropdownMenu } from '@/components/core/DropdownMenu';
import { getSupportedLocaleOptions, normalizeLocale, type SupportedLocale } from '@/lib/i18n/locale';
import { buildContentLanguageHref } from '@/lib/translation/content-language';

interface LocalizationInfoLike {
  displayedLocale?: string | null;
  sourceLocale?: string | null;
  availableLocales?: string[] | null;
}

interface ContentLanguageMenuProps {
  pathname: string;
  query?: Record<string, string | string[] | undefined>;
  requestedLocale: string;
  localizationInfo?: LocalizationInfoLike | null;
  includeSourceOption?: boolean;
  withinPortal?: boolean;
  onRequestedLocaleChange?: (locale: SupportedLocale) => void;
}

export function ContentLanguageMenu({
  pathname,
  query,
  requestedLocale,
  localizationInfo,
  includeSourceOption = true,
  withinPortal = true,
  onRequestedLocaleChange,
}: ContentLanguageMenuProps) {
  const t = useTranslations('contentLanguageMenu');
  const tCommonLabels = useTranslations('common.labels');
  const hydrated = useMounted();
  const supportedLocaleOptions = getSupportedLocaleOptions();

  if (!hydrated) {
    return null;
  }

  const effectiveRequested = normalizeLocale(requestedLocale) ?? 'en';
  const sourceLocale = normalizeLocale(localizationInfo?.sourceLocale) ?? effectiveRequested;
  const displayedLocale = normalizeLocale(localizationInfo?.displayedLocale) ?? effectiveRequested;
  const normalizedAvailableLocales = Array.from(
    new Set(
      (localizationInfo?.availableLocales ?? []).reduce<SupportedLocale[]>((accumulator, locale) => {
        const normalizedLocale = normalizeLocale(locale);
        if (normalizedLocale) {
          accumulator.push(normalizedLocale);
        }
        return accumulator;
      }, []),
    ),
  );
  const localeOptions =
    normalizedAvailableLocales.length > 0
      ? supportedLocaleOptions.filter((option) => normalizedAvailableLocales.includes(option.value))
      : supportedLocaleOptions;
  const selectedKey = localeOptions.some((option) => option.value === effectiveRequested)
    ? effectiveRequested
    : displayedLocale;
  const sourceSelected = includeSourceOption && selectedKey === sourceLocale;

  const requestedLabel =
    localeOptions.find((option) => option.value === effectiveRequested)?.label ??
    supportedLocaleOptions.find((option) => option.value === effectiveRequested)?.label ??
    effectiveRequested;
  const sourceLabel = supportedLocaleOptions.find((option) => option.value === sourceLocale)?.label ?? sourceLocale;
  const buttonLabel = sourceSelected ? sourceLabel : requestedLabel;

  return (
    <DropdownMenu size="wide" placement="bottom-end" portal={withinPortal}>
      <DropdownMenu.Target>
        <Button
          size="xs"
          tone="neutral"
          emphasis="medium"
          className="print-hide"
          leftSection={<IconLanguage size={14} />}
          style={{ flexShrink: 0 }}
          aria-label={t('ariaLabel', { locale: buttonLabel })}
        >
          {buttonLabel}
        </Button>
      </DropdownMenu.Target>
      <DropdownMenu.Dropdown>
        {includeSourceOption ? (
          <>
            <DropdownMenu.Label>{tCommonLabels('source')}</DropdownMenu.Label>
            {onRequestedLocaleChange ? (
              <DropdownMenu.Item onClick={() => onRequestedLocaleChange(sourceLocale)} selected={sourceSelected}>
                {t('sourceOption', { locale: sourceLabel })}
              </DropdownMenu.Item>
            ) : (
              <DropdownMenu.Item
                component={Link}
                href={buildContentLanguageHref(pathname, query, {
                  requestedLocale: sourceLocale,
                })}
                selected={sourceSelected}
              >
                {t('sourceOption', { locale: sourceLabel })}
              </DropdownMenu.Item>
            )}
            <DropdownMenu.Divider />
          </>
        ) : null}
        <DropdownMenu.Label>{t('label')}</DropdownMenu.Label>
        {localeOptions
          .filter((option) => option.value !== sourceLocale)
          .map((option) => {
            const label = option.label;
            return onRequestedLocaleChange ? (
              <DropdownMenu.Item
                key={option.value}
                onClick={() => onRequestedLocaleChange(option.value)}
                selected={selectedKey === option.value}
              >
                {label}
              </DropdownMenu.Item>
            ) : (
              <DropdownMenu.Item
                key={option.value}
                component={Link}
                href={buildContentLanguageHref(pathname, query, {
                  requestedLocale: option.value,
                })}
                selected={selectedKey === option.value}
              >
                {label}
              </DropdownMenu.Item>
            );
          })}
      </DropdownMenu.Dropdown>
    </DropdownMenu>
  );
}
