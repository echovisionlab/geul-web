'use client';

import { startTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { IconLanguage } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { notifications } from '@mantine/notifications';
import { IconButton, type IconButtonProps } from '@/components/core/IconButton';
import { DropdownMenu } from '@/components/core/DropdownMenu';
import { TextButton, type TextButtonSize } from '@/components/core/TextButton';
import { updatePreferredLocaleAction } from '@/lib/actions/user-preference';
import { useSession } from '@/lib/auth/client';
import { getSupportedLocaleOptions, type SupportedLocale } from '@/lib/i18n/locale';
import { writeLocaleCookie } from '@/lib/i18n/locale-cookie';
import { useLocale } from '@/lib/providers/LocaleProvider';

interface LanguageMenuProps {
  variant?: 'icon' | 'text';
  size?: IconButtonProps['size'];
  textSize?: TextButtonSize;
}

export function LanguageMenu({ variant = 'icon', size = 32, textSize = 'xs' }: LanguageMenuProps) {
  const router = useRouter();
  const tShell = useTranslations('shell');
  const currentLocale = useLocale();
  const { data: session, isPending } = useSession();
  const localeOptions = useMemo(() => getSupportedLocaleOptions(), []);

  const updateLocaleMutation = useMutation({
    mutationFn: async (nextLocale: SupportedLocale) => {
      if (session?.user?.id) {
        const result = await updatePreferredLocaleAction(nextLocale);
        if (!result.success || !result.preferred_locale) {
          throw new Error(result.error ?? 'Failed to update language preference');
        }

        return result.preferred_locale as SupportedLocale;
      }

      writeLocaleCookie(nextLocale);
      return nextLocale;
    },
    onSuccess: (nextLocale) => {
      writeLocaleCookie(nextLocale);
      startTransition(() => {
        router.refresh();
      });
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: tShell('language.errorTitle'),
        message: error instanceof Error ? error.message : tShell('language.errorMessage'),
      });
    },
  });

  const currentLocaleLabel = localeOptions.find((option) => option.value === currentLocale)?.label ?? currentLocale;

  const dropdown = (
    <DropdownMenu.Dropdown>
      {localeOptions.map((option) => (
        <DropdownMenu.Item
          key={option.value}
          disabled={isPending || updateLocaleMutation.isPending}
          selected={option.value === currentLocale}
          onClick={() => {
            if (option.value !== currentLocale) {
              updateLocaleMutation.mutate(option.value);
            }
          }}
        >
          {option.label}
        </DropdownMenu.Item>
      ))}
    </DropdownMenu.Dropdown>
  );

  if (variant === 'text') {
    return (
      <DropdownMenu size="wide" placement="top-end" portal={false}>
        <DropdownMenu.Target>
          <TextButton
            type="button"
            appearance="muted"
            size={textSize}
            controlSize="xs"
            aria-label={tShell('actions.language')}
            disabled={isPending || updateLocaleMutation.isPending}
          >
            {currentLocaleLabel}
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
          disabled={isPending || updateLocaleMutation.isPending}
        >
          <IconLanguage size={16} />
        </IconButton>
      </DropdownMenu.Target>
      {dropdown}
    </DropdownMenu>
  );
}
