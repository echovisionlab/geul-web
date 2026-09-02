'use client';

import NextImage from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Anchor, Box, Group, Stack, Text } from '@mantine/core';
import { isManagedCdnAssetUrl } from '@/lib/utils/file-url';
import classes from './CreditList.module.css';

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

interface CreditListItemProps {
  name: string;
  role?: string | null;
  note?: string | null;
  href?: string | null;
  imageUrl?: string | null;
}

interface CreditListGroupProps {
  name: string;
  children: React.ReactNode;
}

interface CreditListRootProps {
  title?: string;
  children: React.ReactNode;
}

/* -------------------------------------------------------------------------- */
/*                              CreditList.Item                               */
/* -------------------------------------------------------------------------- */

function CreditListItem({ name, role, note, href, imageUrl }: CreditListItemProps) {
  const nameElement = href ? (
    <Anchor component={Link} href={href} className={classes.itemLink}>
      {name}
    </Anchor>
  ) : (
    name
  );

  return (
    <Group gap="xs" role="listitem">
      {imageUrl ? (
        <Box
          style={{
            width: 26,
            height: 26,
            borderRadius: '50%',
            overflow: 'hidden',
            position: 'relative',
            flexShrink: 0,
          }}
        >
          <NextImage
            src={imageUrl}
            alt={name}
            fill
            sizes="26px"
            style={{ objectFit: 'cover' }}
            unoptimized={imageUrl.startsWith('http') && !isManagedCdnAssetUrl(imageUrl)}
          />
        </Box>
      ) : (
        <Box
          style={{
            width: 26,
            height: 26,
            borderRadius: '50%',
            backgroundColor: 'var(--mantine-color-blue-filled)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: 11,
            fontWeight: 500,
            flexShrink: 0,
          }}
        >
          {name.charAt(0)}
        </Box>
      )}
      <Stack gap={0}>
        <Text size="sm">
          {nameElement}
          {role && (
            <Text span c="dimmed">
              {' '}
              — {role}
            </Text>
          )}
        </Text>
        {note ? (
          <Text size="xs" c="dimmed">
            {note}
          </Text>
        ) : null}
      </Stack>
    </Group>
  );
}

/* -------------------------------------------------------------------------- */
/*                              CreditList.Group                              */
/* -------------------------------------------------------------------------- */

function CreditListGroup({ name, children }: CreditListGroupProps) {
  const t = useTranslations('creditList');

  return (
    <Stack gap={4}>
      <Text size="sm" c="dimmed" fw={500}>
        {name}
      </Text>
      <Stack gap={2} pl="sm" role="list" aria-label={t('groupAriaLabel', { name })}>
        {children}
      </Stack>
    </Stack>
  );
}

/* -------------------------------------------------------------------------- */
/*                               CreditList Root                              */
/* -------------------------------------------------------------------------- */

function CreditListRoot({ title, children }: CreditListRootProps) {
  const tCommon = useTranslations('common');

  return (
    <Stack gap="sm">
      <Text size="sm" fw={500}>
        {title || tCommon('entities.credits')}
      </Text>
      <Stack gap="sm">{children}</Stack>
    </Stack>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  Export                                    */
/* -------------------------------------------------------------------------- */

export const CreditList = Object.assign(CreditListRoot, {
  Group: CreditListGroup,
  Item: CreditListItem,
});
