'use client';

import { useEffect, useId, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { IconLanguage } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { notifications } from '@/components/core/Notification';
import { IconButton, type IconButtonProps } from '@/components/core/IconButton';
import { OnDemandDropdownMenu as DropdownMenu } from '@/components/core/DropdownMenu/OnDemandDropdownMenu';
import { TextButton, type TextButtonSize } from '@/components/core/TextButton';
import { Text, VisuallyHidden } from '@/components/core/Typography';
import { updatePreferredLocaleAction } from '@/lib/actions/user-preference';
import { useSession } from '@/lib/auth/client';
import { getSupportedLocaleOptions, type SupportedLocale } from '@/lib/i18n/locale';
import { writeLocaleCookie } from '@/lib/i18n/locale-cookie';
import { CONTENT_LANGUAGE_QUERY_PARAM } from '@/lib/translation/content-language';
import { useLocale } from '@/lib/providers/LocaleProvider';

interface LanguageMenuProps {
  /** `navigation` is a full-width row matching the navigation drawer's links. */
  variant?: 'icon' | 'text' | 'navigation';
  size?: IconButtonProps['size'];
  textSize?: TextButtonSize;
}

export function LanguageMenu({ variant = 'icon', size = 'chrome', textSize = 'xs' }: LanguageMenuProps) {
  const descriptionId = useId();
  const router = useRouter();
  const tShell = useTranslations('shell');
  const currentLocale = useLocale();
  const { data: session, isPending } = useSession();
  const localeOptions = useMemo(() => getSupportedLocaleOptions(), []);

  // One request at a time; the controls stay disabled until it settles (shell chrome does not load React Query).
  const [updatingLocale, setUpdatingLocale] = useState(false);
  const [navigating, startTransition] = useTransition();
  const operation = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!updatingLocale && !navigating) {
      operation.current = false;
    }
  }, [updatingLocale, navigating]);
  const busy = updatingLocale || navigating;
  const updateLocale = async (nextLocale: SupportedLocale) => {
    if (operation.current || isPending) {
      return;
    }
    operation.current = true;
    setUpdatingLocale(true);
    try {
      let resolvedLocale = nextLocale;
      if (session?.user?.id) {
        const result = await updatePreferredLocaleAction(nextLocale);
        if (!result.success || !result.preferred_locale) {
          throw new Error(result.error ?? 'Failed to update language preference');
        }
        resolvedLocale = result.preferred_locale as SupportedLocale;
      } else {
        writeLocaleCookie(nextLocale);
      }
      if (!mounted.current) {
        return;
      }
      writeLocaleCookie(resolvedLocale);
      // A content language in the URL (`?lang=`) outranks the site language; changing the site
      // language drops it so the document follows the new choice.
      const url = new URL(window.location.href);
      const pinned = url.searchParams.has(CONTENT_LANGUAGE_QUERY_PARAM);
      url.searchParams.delete(CONTENT_LANGUAGE_QUERY_PARAM);
      startTransition(async () => {
        if (pinned) {
          await router.replace(`${url.pathname}${url.search}${url.hash}`, { scroll: false });
        } else {
          await router.refresh();
        }
      });
    } catch (error) {
      if (!mounted.current) {
        return;
      }
      notifications.show({
        tone: 'danger',
        title: tShell('language.errorTitle'),
        message: error instanceof Error ? error.message : tShell('language.errorMessage'),
      });
    } finally {
      if (mounted.current) {
        setUpdatingLocale(false);
      }
    }
  };

  const currentLocaleLabel = localeOptions.find((option) => option.value === currentLocale)?.label ?? currentLocale;

  const dropdown = (
    <DropdownMenu.Dropdown>
      {localeOptions.map((option) => (
        <DropdownMenu.Item
          key={option.value}
          disabled={isPending || busy}
          selected={option.value === currentLocale}
          onClick={() => {
            if (option.value !== currentLocale && !busy) {
              return updateLocale(option.value);
            }
          }}
        >
          {option.label}
        </DropdownMenu.Item>
      ))}
    </DropdownMenu.Dropdown>
  );

  if (variant === 'navigation') {
    return (
      <DropdownMenu size="wide" placement="bottom-start" portal>
        <DropdownMenu.Target>
          <TextButton
            type="button"
            density="chrome"
            display="flex"
            fullWidth
            justify="start"
            indicator="menu"
            aria-label={currentLocaleLabel}
            aria-describedby={descriptionId}
            loading={busy}
            disabled={isPending || busy}
          >
            <Text size="xs">{currentLocaleLabel}</Text>
            <VisuallyHidden id={descriptionId}>{tShell('actions.language')}</VisuallyHidden>
          </TextButton>
        </DropdownMenu.Target>
        {dropdown}
      </DropdownMenu>
    );
  }

  if (variant === 'text') {
    return (
      <DropdownMenu size="wide" placement="top-end" portal={false}>
        <DropdownMenu.Target>
          <TextButton
            type="button"
            appearance="muted"
            size={textSize}
            controlSize="xs"
            indicator="menu"
            aria-label={currentLocaleLabel}
            aria-describedby={descriptionId}
            loading={busy}
            disabled={isPending || busy}
          >
            {currentLocaleLabel}
            <VisuallyHidden id={descriptionId}>{tShell('actions.language')}</VisuallyHidden>
          </TextButton>
        </DropdownMenu.Target>
        {dropdown}
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu size="wide" placement="bottom-end" portal>
      <DropdownMenu.Target>
        <IconButton
          size={size}
          aria-label={tShell('actions.language')}
          title={tShell('actions.language')}
          loading={busy}
          disabled={isPending || busy}
        >
          <IconLanguage size={16} />
        </IconButton>
      </DropdownMenu.Target>
      {dropdown}
    </DropdownMenu>
  );
}
