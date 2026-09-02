'use client';

import { useState } from 'react';
import { FileDownloadAction, FileDownloadAvailability } from '@echovisionlab/geul-proto/public/file_pb.ts';
import { useTranslations } from 'next-intl';
import { IconDownload } from '@tabler/icons-react';
import { Text, VisuallyHidden } from '@mantine/core';
import { Button } from '@/components/core/Button';
import { IconButton } from '@/components/core/IconButton';
import { Tooltip } from '@/components/core/Tooltip';
import { buildLoginRedirectHref } from '@/lib/auth/login-page';
import { authorizeFileDownload, type AuthorizeFileDownloadInput } from '@/lib/queries/file-download-browser';

interface AuthorizedDownloadResult {
  access?: {
    availability: FileDownloadAvailability;
    action: FileDownloadAction;
  };
  download?: { url: string } | undefined;
}

export interface AuthorizedDownloadActionProps extends AuthorizeFileDownloadInput {
  availability: FileDownloadAvailability;
  action: FileDownloadAction;
  fileName: string;
  title?: string;
  returnTo?: string;
  authorize?: (input: AuthorizeFileDownloadInput) => Promise<AuthorizedDownloadResult>;
  navigate?: (href: string) => void;
  compact?: boolean;
  initialDownloadUrl?: string;
  initialDownloadExpiresAt?: string;
  allowFileAuthorization?: boolean;
  presentation?: 'button' | 'icon';
}

export function AuthorizedDownloadAction({
  availability,
  action,
  fileName,
  title,
  returnTo,
  authorize,
  navigate,
  compact = true,
  initialDownloadUrl,
  initialDownloadExpiresAt,
  allowFileAuthorization = true,
  presentation = 'button',
  ...input
}: AuthorizedDownloadActionProps) {
  const t = useTranslations('fileDownloadAccess.public');
  const [effectiveAvailability, setEffectiveAvailability] = useState(availability);
  const [effectiveAction, setEffectiveAction] = useState(action);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const context = title?.trim() || fileName.trim() || t('fileFallback');
  const go = (href: string) => {
    if (navigate) {
      navigate(href);
    } else {
      window.location.assign(href);
    }
  };

  if (
    effectiveAvailability !== FileDownloadAvailability.AVAILABLE ||
    effectiveAction === FileDownloadAction.NONE ||
    effectiveAction === FileDownloadAction.UNSPECIFIED
  ) {
    if (presentation === 'icon') {
      const unavailableLabel = t('unavailableFor', { name: context });
      return (
        <Tooltip label={unavailableLabel} withArrow>
          <span>
            <IconButton
              label={unavailableLabel}
              size="sm"
              emphasis="low"
              disabled
              data-authorized-download-action="icon"
            >
              <IconDownload size={16} />
            </IconButton>
          </span>
        </Tooltip>
      );
    }
    return (
      <Text size="xs" c="dimmed" role="status" aria-label={t('unavailableFor', { name: context })}>
        {t('unavailable')}
      </Text>
    );
  }

  const isSignIn = effectiveAction === FileDownloadAction.SIGN_IN;
  const handleClick = async () => {
    setError('');
    if (isSignIn) {
      const currentLocation = returnTo || `${window.location.pathname}${window.location.search}${window.location.hash}`;
      go(buildLoginRedirectHref(currentLocation));
      return;
    }

    const initialExpiry = initialDownloadExpiresAt ? Date.parse(initialDownloadExpiresAt) : Number.NaN;
    if (initialDownloadUrl && (!Number.isFinite(initialExpiry) || initialExpiry > Date.now() + 5_000)) {
      go(initialDownloadUrl);
      return;
    }

    setLoading(true);
    try {
      if (!authorize && !allowFileAuthorization) {
        setError(t('failed'));
        return;
      }
      const response = await (authorize ?? authorizeFileDownload)(input);
      const responseAvailability = response.access?.availability ?? FileDownloadAvailability.UNAVAILABLE;
      const responseAction = response.access?.action ?? FileDownloadAction.NONE;
      setEffectiveAvailability(responseAvailability);
      setEffectiveAction(responseAction);
      if (
        responseAvailability === FileDownloadAvailability.AVAILABLE &&
        responseAction === FileDownloadAction.DOWNLOAD &&
        response.download?.url
      ) {
        go(response.download.url);
        return;
      }
      if (responseAction === FileDownloadAction.SIGN_IN) {
        const currentLocation =
          returnTo || `${window.location.pathname}${window.location.search}${window.location.hash}`;
        go(buildLoginRedirectHref(currentLocation));
        return;
      }
      setError(t('unavailable'));
    } catch {
      setError(t('failed'));
    } finally {
      setLoading(false);
    }
  };

  const actionLabel = isSignIn ? t('signInFor', { name: context }) : t('downloadFor', { name: context });

  if (presentation === 'icon') {
    const tooltipLabel = error || actionLabel;
    return (
      <>
        <Tooltip label={tooltipLabel} withArrow>
          <IconButton
            label={actionLabel}
            size="sm"
            emphasis="low"
            loading={loading}
            onClick={() => void handleClick()}
            data-authorized-download-action="icon"
          >
            <IconDownload size={16} />
          </IconButton>
        </Tooltip>
        {error ? (
          <VisuallyHidden role="alert" aria-live="assertive">
            {error}
          </VisuallyHidden>
        ) : null}
      </>
    );
  }

  return (
    <>
      <Button
        size={compact ? 'xs' : 'sm'}
        emphasis="medium"
        loading={loading}
        aria-label={actionLabel}
        onClick={() => void handleClick()}
      >
        {isSignIn ? t('signIn') : t('download')}
      </Button>
      {error ? (
        <Text size="xs" c="red" role="alert">
          {error}
        </Text>
      ) : null}
    </>
  );
}
