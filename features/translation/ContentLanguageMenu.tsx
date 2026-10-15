'use client';

import { formatLocaleCode } from '@/components/core/Typography/locale-code';

import { useTranslations } from 'next-intl';
import { useMounted } from '@mantine/hooks';
import { Button, type ButtonProps } from '@/components/core/Button';
// Public pages: the menu and hint surfaces load on first hover/focus/press (same markup and behaviour).
import { OnDemandDropdownMenu as DropdownMenu } from '@/components/core/DropdownMenu/OnDemandDropdownMenu';
import { OnDemandTooltip as Tooltip } from '@/components/core/Tooltip/OnDemandTooltip';
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
  contrast?: ButtonProps['contrast'];
  onRequestedLocaleChange?: (locale: SupportedLocale) => void;
}

export function ContentLanguageMenu({
  pathname,
  query,
  requestedLocale,
  localizationInfo,
  includeSourceOption = true,
  withinPortal = true,
  contrast,
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
  const sourceSelected = includeSourceOption && displayedLocale === sourceLocale;
  const sourceLabel =
    supportedLocaleOptions.find((option) => option.value === sourceLocale)?.label ?? formatLocaleCode(sourceLocale);
  const buttonLabel =
    supportedLocaleOptions.find((option) => option.value === displayedLocale)?.label ??
    formatLocaleCode(displayedLocale);

  return (
    <DropdownMenu size="wide" placement="bottom-end" portal={withinPortal}>
      <Tooltip label={buttonLabel} events={{ hover: true, focus: true, touch: false }}>
        <DropdownMenu.Target>
          <Button
            contrast={contrast}
            indicator="menu"
            size="xs"
            tone="neutral"
            emphasis="low"
            printVisibility="hidden"
            aria-label={t('ariaLabel', { locale: buttonLabel })}
          >
            {buttonLabel}
          </Button>
        </DropdownMenu.Target>
      </Tooltip>
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
                selected={displayedLocale === option.value}
              >
                {label}
              </DropdownMenu.Item>
            ) : (
              <DropdownMenu.Item
                key={option.value}
                href={buildContentLanguageHref(pathname, query, {
                  requestedLocale: option.value,
                })}
                selected={displayedLocale === option.value}
              >
                {label}
              </DropdownMenu.Item>
            );
          })}
      </DropdownMenu.Dropdown>
    </DropdownMenu>
  );
}
