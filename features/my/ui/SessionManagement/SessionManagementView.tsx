'use client';

import { useEffect, useId, useRef } from 'react';

import { LayoutStack as DsLayoutStack, LayoutInline as DsLayoutInline, LayoutInset } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { IconDeviceDesktop, IconDeviceMobile, IconX } from '@tabler/icons-react';
import { LabelBadge } from '@/components/core/Badge';
import { Button } from '@/components/core/Button';
import { IconButton } from '@/components/core/IconButton';
import { SectionCard, SectionHeader } from '@/components/core/Section';
import { Tooltip } from '@/components/core/Tooltip';

type DeviceKind = 'desktop' | 'mobile' | 'tablet' | 'unknown';
type BrowserKind = 'chrome' | 'edge' | 'firefox' | 'opera' | 'safari' | 'unknown';
type OsKind = 'android' | 'ios' | 'linux' | 'macos' | 'windows' | 'unknown';

export interface SessionManagementLabels {
  activeNow: string;
  browser: (browser: BrowserKind) => string;
  device: (device: DeviceKind) => string;
  logOutOthers: string;
  os: (os: OsKind) => string;
  revoke: string;
  thisDevice: string;
  title: string;
}

export interface SessionManagementItem {
  id: string;
  active: boolean;
  authenticatedAt: Date | string;
  device?: {
    ipAddress?: string | null;
    userAgent?: string | null;
  };
}

interface SessionManagementViewProps {
  currentSessionId: string | null | undefined;
  labels: SessionManagementLabels;
  locale: string;
  onRevokeOtherSessions: () => void;
  onRevokeSession: (sessionId: string) => void;
  revokingSessionId: string | null;
  revokeOthersLoading: boolean;
  sessions: SessionManagementItem[];
}

function parseUserAgent(ua: string | null | undefined): {
  device: DeviceKind;
  browser: BrowserKind;
  os: OsKind;
} {
  if (!ua) {
    return { device: 'unknown', browser: 'unknown', os: 'unknown' };
  }

  let browser: BrowserKind = 'unknown';
  let os: OsKind = 'unknown';
  let device: DeviceKind = 'desktop';

  if (ua.includes('Firefox')) {
    browser = 'firefox';
  } else if (ua.includes('Edg')) {
    browser = 'edge';
  } else if (ua.includes('Chrome')) {
    browser = 'chrome';
  } else if (ua.includes('Safari')) {
    browser = 'safari';
  } else if (ua.includes('Opera') || ua.includes('OPR')) {
    browser = 'opera';
  }

  if (ua.includes('Windows')) {
    os = 'windows';
  } else if (ua.includes('Mac OS')) {
    os = 'macos';
  } else if (ua.includes('Linux')) {
    os = 'linux';
  } else if (ua.includes('Android')) {
    os = 'android';
  } else if (ua.includes('iPhone') || ua.includes('iPad')) {
    os = 'ios';
  }

  if (ua.includes('Mobile') || ua.includes('Android') || ua.includes('iPhone')) {
    device = 'mobile';
  } else if (ua.includes('iPad') || ua.includes('Tablet')) {
    device = 'tablet';
  }

  return { device, browser, os };
}

function maskIpAddress(ip: string | null | undefined): string {
  if (!ip) {
    return '-';
  }
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.*`;
  }
  return `${ip.split(':').slice(0, 3).join(':')}:*`;
}

function getRelativeTime(date: Date | string, locale: string, activeNowLabel: string): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (diffMins < 1) {
    return activeNowLabel;
  }
  if (diffMins < 60) {
    return formatter.format(-diffMins, 'minute');
  }
  if (diffHours < 24) {
    return formatter.format(-diffHours, 'hour');
  }
  return formatter.format(-diffDays, 'day');
}

export function SessionManagementView({
  currentSessionId,
  labels,
  locale,
  onRevokeOtherSessions,
  onRevokeSession,
  revokingSessionId,
  revokeOthersLoading,
  sessions,
}: SessionManagementViewProps) {
  const scopeId = useId();
  const viewRef = useRef<HTMLElement>(null);
  const removedFocus = useRef<string | 'others' | null>(null);
  useEffect(() => {
    const id = removedFocus.current;
    if (!id || (id !== 'others' && sessions.some((session) => session.id === id))) {
      return;
    }
    if (id === 'others' && sessions.some((session) => session.id !== currentSessionId)) {
      return;
    }
    removedFocus.current = null;
    const target =
      viewRef.current?.querySelector<HTMLElement>('button:not(:disabled)') ??
      viewRef.current?.querySelector<HTMLElement>('[role="heading"]');
    target?.focus();
  }, [currentSessionId, sessions]);
  const otherSessionsCount = sessions.filter((session) => session.id !== currentSessionId).length;

  return (
    <DsLayoutStack ref={viewRef} gap="md">
      <SectionHeader
        title={
          <span role="heading" aria-level={2} tabIndex={-1}>
            {labels.title}
          </span>
        }
      />
      <DsLayoutStack gap="sm">
        {sessions.map((session) => {
          const { device, browser, os } = parseUserAgent(session.device?.userAgent);
          const isCurrentSession = session.id === currentSessionId;
          const isRevoking = revokingSessionId === session.id;

          return (
            <SectionCard
              appearance="plain"
              key={session.id}
              padding="sm"
              role="group"
              aria-labelledby={`${scopeId}-${session.id}-name`}
              aria-describedby={`${scopeId}-${session.id}-details`}
            >
              <DsLayoutInline justify="between" wrap="nowrap">
                <DsLayoutInline gap="sm" wrap="nowrap">
                  <DsText as="span" tone="secondary">
                    {device === 'mobile' || device === 'tablet' ? (
                      <IconDeviceMobile size={24} aria-hidden />
                    ) : (
                      <IconDeviceDesktop size={24} aria-hidden />
                    )}
                  </DsText>
                  <div>
                    <DsLayoutInline gap="xs">
                      <DsText id={`${scopeId}-${session.id}-name`} size="sm" weight="medium">
                        {labels.browser(browser)} · {labels.os(os)}
                      </DsText>
                      {isCurrentSession ? <LabelBadge tone="positive">{labels.thisDevice}</LabelBadge> : null}
                    </DsLayoutInline>
                    <DsText id={`${scopeId}-${session.id}-details`} size="xs" tone="secondary">
                      {maskIpAddress(session.device?.ipAddress)} · {labels.device(device)} ·{' '}
                      {getRelativeTime(session.authenticatedAt, locale, labels.activeNow)}
                    </DsText>
                  </div>
                </DsLayoutInline>
                {!isCurrentSession ? (
                  <Tooltip label={labels.revoke} withArrow>
                    <IconButton
                      tone="neutral"
                      emphasis="low"
                      aria-label={labels.revoke}
                      aria-describedby={`${scopeId}-${session.id}-name ${scopeId}-${session.id}-details`}
                      onClick={() => {
                        removedFocus.current = session.id;
                        onRevokeSession(session.id);
                      }}
                      loading={isRevoking}
                      disabled={revokingSessionId !== null || revokeOthersLoading}
                      data-testid={`security-revoke-session-${session.id}`}
                    >
                      <IconX size={16} aria-hidden />
                    </IconButton>
                  </Tooltip>
                ) : null}
              </DsLayoutInline>
            </SectionCard>
          );
        })}

        {otherSessionsCount > 0 ? (
          <LayoutInset blockStart="sm">
            <DsLayoutInline justify="end" gap="action-group" data-testid="security-session-actions">
              <Button
                tone="danger"
                emphasis="medium"
                onClick={() => {
                  removedFocus.current = 'others';
                  onRevokeOtherSessions();
                }}
                loading={revokeOthersLoading}
                disabled={revokingSessionId !== null}
                data-testid="security-revoke-other-sessions"
              >
                {labels.logOutOthers}
              </Button>
            </DsLayoutInline>
          </LayoutInset>
        ) : null}
      </DsLayoutStack>
    </DsLayoutStack>
  );
}
