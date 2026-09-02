'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { IconLanguage, IconX } from '@tabler/icons-react';
import { Group, Stack, Text } from '@mantine/core';
import { Alert, type AlertTone } from '@/components/core/Alert';
import { Button } from '@/components/core/Button';
import { IconButton } from '@/components/core/IconButton';
import { TextButton } from '@/components/core/TextButton';

interface LocalizationNoticeClientProps {
  dismissKey: string;
  variant?: 'subtle' | 'banner';
  title: string;
  description: string;
  tone: AlertTone;
  dismissLabel: string;
  originalHref?: string | null;
  originalLabel?: string | null;
  onOriginalClick?: () => void;
  translatedHref?: string | null;
  translatedLabel?: string | null;
}

export function LocalizationNoticeClient({
  dismissKey,
  variant = 'subtle',
  title,
  description,
  tone,
  dismissLabel,
  originalHref,
  originalLabel,
  onOriginalClick,
  translatedHref,
  translatedLabel,
}: LocalizationNoticeClientProps) {
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    try {
      setIsHidden(window.localStorage.getItem(dismissKey) === '1');
    } catch {
      setIsHidden(false);
    }
  }, [dismissKey]);

  if (isHidden) {
    return null;
  }

  if (variant === 'subtle') {
    return (
      <Group data-localization-notice gap={8} wrap="wrap" align="center" mb="sm" className="print-hide">
        <Group gap={6} wrap="nowrap" align="center" style={{ flex: '1 1 240px', minWidth: 0 }}>
          <IconLanguage size={14} />
          <Text size="xs" c="dimmed">
            {description}
          </Text>
        </Group>
        <Group gap={6} wrap="wrap" align="center">
          {originalHref && originalLabel ? (
            onOriginalClick ? (
              <TextButton onClick={onOriginalClick} size="xs" weight="medium" appearance="accent">
                {originalLabel}
              </TextButton>
            ) : (
              <TextButton href={originalHref} size="xs" weight="medium" appearance="accent">
                {originalLabel}
              </TextButton>
            )
          ) : null}
          <IconButton
            tone="neutral"
            emphasis="low"
            size="xs"
            aria-label={dismissLabel}
            onClick={() => {
              try {
                window.localStorage.setItem(dismissKey, '1');
              } catch {
                // Best-effort only.
              }
              setIsHidden(true);
            }}
          >
            <IconX size={12} />
          </IconButton>
        </Group>
      </Group>
    );
  }

  return (
    <Alert data-localization-notice icon={<IconLanguage size={16} />} tone={tone} mb="md" className="print-hide">
      <Stack gap={6}>
        <Text size="sm" fw={600}>
          {title}
        </Text>
        <Text size="sm">{description}</Text>
        <Group gap="xs">
          {originalHref && originalLabel ? (
            onOriginalClick ? (
              <Button onClick={onOriginalClick} size="xs" tone="neutral" emphasis="medium">
                {originalLabel}
              </Button>
            ) : (
              <Button component={Link} href={originalHref} size="xs" tone="neutral" emphasis="medium">
                {originalLabel}
              </Button>
            )
          ) : null}
          {translatedHref && translatedLabel ? (
            <Button component={Link} href={translatedHref} size="xs" tone="neutral" emphasis="medium">
              {translatedLabel}
            </Button>
          ) : null}
          <Button
            size="xs"
            emphasis="low"
            onClick={() => {
              try {
                window.localStorage.setItem(dismissKey, '1');
              } catch {
                // Best-effort only.
              }
              setIsHidden(true);
            }}
          >
            {dismissLabel}
          </Button>
        </Group>
      </Stack>
    </Alert>
  );
}
