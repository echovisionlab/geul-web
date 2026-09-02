'use client';

import { IconDeviceDesktop, IconDeviceMobile, IconX } from '@tabler/icons-react';
import { Box, Group, Stack, Text } from '@mantine/core';
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
  description: string;
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
  const otherSessionsCount = sessions.filter((session) => session.id !== currentSessionId).length;

  return (
    <>
      <SectionHeader title={labels.title} description={labels.description} />
      <Stack gap="sm">
        {sessions.map((session) => {
          const { device, browser, os } = parseUserAgent(session.device?.userAgent);
          const isCurrentSession = session.id === currentSessionId;
          const isRevoking = revokingSessionId === session.id;

          return (
            <SectionCard key={session.id} p="sm">
              <Group justify="space-between" wrap="nowrap">
                <Group gap="sm" wrap="nowrap">
                  <Box c="dimmed">
                    {device === 'mobile' || device === 'tablet' ? (
                      <IconDeviceMobile size={24} />
                    ) : (
                      <IconDeviceDesktop size={24} />
                    )}
                  </Box>
                  <Box>
                    <Group gap="xs">
                      <Text size="sm" fw={500}>
                        {labels.browser(browser)} · {labels.os(os)}
                      </Text>
                      {isCurrentSession ? (
                        <LabelBadge size="xs" tone="positive">
                          {labels.thisDevice}
                        </LabelBadge>
                      ) : null}
                    </Group>
                    <Text size="xs" c="dimmed">
                      {maskIpAddress(session.device?.ipAddress)} · {labels.device(device)} ·{' '}
                      {getRelativeTime(session.authenticatedAt, locale, labels.activeNow)}
                    </Text>
                  </Box>
                </Group>
                {!isCurrentSession ? (
                  <Tooltip label={labels.revoke} withArrow>
                    <IconButton
                      tone="neutral"
                      emphasis="low"
                      aria-label={labels.revoke}
                      onClick={() => onRevokeSession(session.id)}
                      loading={isRevoking}
                      disabled={isRevoking}
                      data-testid={`security-revoke-session-${session.id}`}
                    >
                      <IconX size={16} />
                    </IconButton>
                  </Tooltip>
                ) : null}
              </Group>
            </SectionCard>
          );
        })}

        {otherSessionsCount > 0 ? (
          <Button
            tone="danger"
            emphasis="medium"
            mt="sm"
            onClick={onRevokeOtherSessions}
            loading={revokeOthersLoading}
            data-testid="security-revoke-other-sessions"
          >
            {labels.logOutOthers}
          </Button>
        ) : null}
      </Stack>
    </>
  );
}
