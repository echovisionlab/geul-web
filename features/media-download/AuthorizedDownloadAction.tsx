'use client';
import { VisuallyHidden, Text as DsText } from '@/components/core/Typography';
import { useEffect, useId, useRef, useState } from 'react';
import type { FileDownloadAction, FileDownloadAvailability } from '@echovisionlab/geul-proto/public/file_pb.ts';
import { useTranslations } from 'next-intl';
import { IconDownload } from '@tabler/icons-react';
import { Button } from '@/components/core/Button';
import { IconButton } from '@/components/core/IconButton';
import { Tooltip } from '@/components/core/Tooltip';
import { buildLoginRedirectHref } from '@/lib/auth/login-page';
import type { AuthorizeFileDownloadInput } from '@/lib/queries/file-download-browser';
import { FILE_DOWNLOAD_ACTION, FILE_DOWNLOAD_AVAILABILITY } from './download-wire-values';
interface AuthorizedDownloadResult {
  access?: {
    availability: FileDownloadAvailability;
    action: FileDownloadAction;
  };
  download?:
    | {
        url: string;
      }
    | undefined;
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
  const errorId = useId();
  const requestGeneration = useRef(0);
  const authorizationKey = JSON.stringify([
    input.entityType,
    input.entityId,
    input.selector?.blockId,
    input.selector?.referencePath,
    input.trackId,
    fileName,
    initialDownloadUrl,
  ]);
  useEffect(() => {
    requestGeneration.current += 1;
    setEffectiveAvailability(availability);
    setEffectiveAction(action);
    setError('');
    setLoading(false);
    return () => {
      requestGeneration.current += 1;
    };
  }, [authorizationKey, availability, action]);
  const context = title?.trim() || fileName.trim() || t('fileFallback');
  const go = (href: string) => {
    if (navigate) {
      navigate(href);
    } else {
      window.location.assign(href);
    }
  };
  if (
    effectiveAvailability !== FILE_DOWNLOAD_AVAILABILITY.AVAILABLE ||
    effectiveAction === FILE_DOWNLOAD_ACTION.NONE ||
    effectiveAction === FILE_DOWNLOAD_ACTION.UNSPECIFIED
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
      <DsText size="xs" tone="secondary" role="status" aria-label={t('unavailableFor', { name: context })}>
        {t('unavailable')}
      </DsText>
    );
  }
  const isSignIn = effectiveAction === FILE_DOWNLOAD_ACTION.SIGN_IN;
  const handleClick = async () => {
    if (loading) {
      return;
    }
    const generation = requestGeneration.current;
    setError('');
    if (isSignIn) {
      const currentLocation = returnTo || `${window.location.pathname}${window.location.search}${window.location.hash}`;
      go(buildLoginRedirectHref(currentLocation));
      return;
    }
    const initialExpiry = initialDownloadExpiresAt ? Date.parse(initialDownloadExpiresAt) : Number.NaN;
    if (initialDownloadUrl && (!Number.isFinite(initialExpiry) || initialExpiry > Date.now() + 5000)) {
      go(initialDownloadUrl);
      return;
    }
    setLoading(true);
    try {
      if (!authorize && !allowFileAuthorization) {
        setError(t('failed'));
        return;
      }
      // The browser RPC client loads on the first authorization request, not with the page.
      const response = await (authorize ?? (await import('@/lib/queries/file-download-browser')).authorizeFileDownload)(
        input,
      );
      if (generation !== requestGeneration.current) {
        return;
      }
      const responseAvailability = response.access?.availability ?? FILE_DOWNLOAD_AVAILABILITY.UNAVAILABLE;
      const responseAction = response.access?.action ?? FILE_DOWNLOAD_ACTION.NONE;
      setEffectiveAvailability(responseAvailability);
      setEffectiveAction(responseAction);
      if (
        responseAvailability === FILE_DOWNLOAD_AVAILABILITY.AVAILABLE &&
        responseAction === FILE_DOWNLOAD_ACTION.DOWNLOAD &&
        response.download?.url
      ) {
        go(response.download.url);
        return;
      }
      if (responseAction === FILE_DOWNLOAD_ACTION.SIGN_IN) {
        const currentLocation =
          returnTo || `${window.location.pathname}${window.location.search}${window.location.hash}`;
        go(buildLoginRedirectHref(currentLocation));
        return;
      }
      setError(t('unavailable'));
    } catch {
      if (generation === requestGeneration.current) {
        setError(t('failed'));
      }
    } finally {
      if (generation === requestGeneration.current) {
        setLoading(false);
      }
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
            aria-describedby={error ? errorId : undefined}
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
          <VisuallyHidden id={errorId} role="alert" aria-live="assertive">
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
        aria-describedby={error ? errorId : undefined}
        onClick={() => void handleClick()}
      >
        {isSignIn ? t('signIn') : t('download')}
      </Button>
      {error ? (
        <DsText id={errorId} size="xs" tone="danger" role="alert">
          {error}
        </DsText>
      ) : null}
    </>
  );
}
