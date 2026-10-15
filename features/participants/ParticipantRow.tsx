'use client';
import { useId, type ReactNode } from 'react';
import { IconUserOff } from '@tabler/icons-react';
import { LayoutInline } from '@/components/core/Layout';
import { Text } from '@/components/core/Typography';
import { Avatar } from '@/components/core/Display';
import { LabelBadge } from '@/components/core/Badge';
import { Tooltip } from '@/components/core/Tooltip';
import { ActionRowSizeProvider } from '@/components/core/control-context';
import type { ClosedVisualProps } from '@/components/core/visual-contract';
import classes from './ParticipantRow.module.css';

export interface ParticipantRowProps extends ClosedVisualProps {
  memberId: string;
  nickname: string;
  avatarUrl?: string;
  roleLabel: string;
  principal?: boolean;
  inactiveLabel?: string;
  /** Existing identity text used to describe commands outside the visual row. */
  identityId?: string;
  actions: ReactNode;
}
/** Identity, role and action tracks are shared; domain authorization stays with the consumer. */
export function ParticipantRow({
  memberId,
  nickname,
  avatarUrl,
  roleLabel,
  principal,
  inactiveLabel,
  identityId,
  actions,
}: ParticipantRowProps) {
  const generatedId = useId();
  const nameId = identityId ?? `${generatedId}-name`;
  const roleId = `${generatedId}-role`;
  return (
    <LayoutInline
      gap={{ base: 'xs', xs: 'sm' }}
      align="center"
      wrap="nowrap"
      direction={{ base: 'column', xs: 'row' }}
      data-participant-id={memberId}
      role="group"
      aria-labelledby={`${nameId} ${roleId}`}
    >
      <LayoutInline gap="sm" flexible fill="inline" wrap="nowrap">
        <Avatar src={avatarUrl} size="sm" shape="circle" name={nickname} />
        <LayoutInline gap="xxs" flexible wrap="nowrap">
          <Text id={nameId} size="sm" truncate>
            {nickname}
          </Text>
          {inactiveLabel ? (
            <Tooltip label={inactiveLabel}>
              <Text as="span" tone="secondary" role="img" aria-label={inactiveLabel} data-participant-inactive-status>
                <IconUserOff aria-hidden size="1em" />
              </Text>
            </Tooltip>
          ) : null}
        </LayoutInline>
      </LayoutInline>
      <LayoutInline gap="xs" wrap="nowrap" justify="end" fill="inline" data-participant-actions>
        <Tooltip label={roleLabel}>
          <span className={classes.role} data-participant-role-badge>
            <LabelBadge tone={principal ? 'accent' : 'neutral'} size="sm">
              <Text id={roleId} as="span" size="sm" truncate>
                {roleLabel}
              </Text>
            </LabelBadge>
          </span>
        </Tooltip>
        <ActionRowSizeProvider size="sm">{actions}</ActionRowSizeProvider>
      </LayoutInline>
    </LayoutInline>
  );
}
