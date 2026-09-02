'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Avatar, Group, Text } from '@mantine/core';
import { badgeToneFromColor, LabelBadge, StatusBadge } from '@/components/core/Badge';
import { DateTime } from '@/features/date-time/DateTime';
import { TextButton } from '@/components/core/TextButton';
import {
  ServerDataTableSelectableSection,
  type ServerDataTableSelectableSectionProps,
} from '@/features/data-table/ServerDataTable';
import { normalizeEnumToken } from '@/lib/i18n/admin-labels';
import type { ColumnDef } from '@/lib/types/common/data-table';
import { buildManagedImageUrl, MANAGED_IMAGE_PRESET } from '@/lib/utils/managed-image-url';
import { UserNewsletterStatus } from './UserNewsletterStatus';

export interface UserRow {
  id: string;
  email: string | null;
  nickname: string;
  image: string | null;
  role: string | null;
  status: string;
  banned: boolean;
  onboarded: boolean;
  newsletter_subscribed: boolean;
  newsletter_subscribed_at: Date | null;
  created_at: Date;
}

function getStatusTone(status: string): 'positive' | 'danger' | 'warning' | 'neutral' {
  switch (normalizeEnumToken(status)) {
    case 'banned':
      return 'danger';
    case 'pending_deletion':
      return 'warning';
    case 'deleted':
      return 'neutral';
    default:
      return 'positive';
  }
}

function getColumns(
  labels: {
    user: string;
    email: string;
    role: string;
    status: string;
    newsletter: string;
    joined: string;
    roles: { admin: string; author: string; user: string };
    statuses: {
      active: string;
      banned: string;
      pendingDeletion: string;
      deleted: string;
      onboardingPending: string;
      subscribed: string;
      unsubscribed: string;
    };
  },
  renderActions: (row: UserRow) => ReactNode,
): ColumnDef<UserRow>[] {
  return [
    {
      key: 'nickname',
      header: labels.user,
      width: 140,
      minWidth: 140,
      cell: (row) => (
        <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
          <Avatar
            src={buildManagedImageUrl(row.image, MANAGED_IMAGE_PRESET.AVATAR_SM)}
            size="sm"
            radius="xl"
            style={{ flexShrink: 0 }}
          >
            {row.nickname.charAt(0).toUpperCase()}
          </Avatar>
          <TextButton
            href={`/admin/users/${row.id}`}
            size="sm"
            weight="medium"
            appearance="default"
            nowrap
            title={row.nickname}
            style={{ minWidth: 0, maxWidth: 92, overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {row.nickname}
          </TextButton>
        </Group>
      ),
    },
    {
      key: 'email',
      header: labels.email,
      width: 130,
      minWidth: 130,
      cell: (row) => (
        <Text
          size="sm"
          c="dimmed"
          title={row.email ?? undefined}
          style={{ maxWidth: 106, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {row.email || '-'}
        </Text>
      ),
    },
    {
      key: 'role',
      header: labels.role,
      width: 82,
      minWidth: 82,
      cell: (row) => (
        <LabelBadge
          tone={badgeToneFromColor(
            normalizeEnumToken(row.role) === 'admin'
              ? 'red'
              : normalizeEnumToken(row.role) === 'author'
                ? 'violet'
                : 'blue',
          )}
          size="sm"
        >
          {normalizeEnumToken(row.role) === 'admin'
            ? labels.roles.admin
            : normalizeEnumToken(row.role) === 'author'
              ? labels.roles.author
              : normalizeEnumToken(row.role) === 'user'
                ? labels.roles.user
                : row.role}
        </LabelBadge>
      ),
    },
    {
      key: 'status',
      header: labels.status,
      width: 180,
      minWidth: 180,
      cell: (row) => (
        <Group gap={4} wrap="wrap">
          <StatusBadge tone={getStatusTone(row.status)} size="sm">
            {normalizeEnumToken(row.status) === 'banned'
              ? labels.statuses.banned
              : normalizeEnumToken(row.status) === 'pending_deletion'
                ? labels.statuses.pendingDeletion
                : normalizeEnumToken(row.status) === 'deleted'
                  ? labels.statuses.deleted
                  : normalizeEnumToken(row.status) === 'active'
                    ? labels.statuses.active
                    : row.status}
          </StatusBadge>
          {!row.onboarded ? (
            <StatusBadge tone="warning" size="sm">
              {labels.statuses.onboardingPending}
            </StatusBadge>
          ) : null}
        </Group>
      ),
    },
    {
      key: 'newsletter_subscribed',
      header: labels.newsletter,
      width: 120,
      minWidth: 120,
      cell: (row) => (
        <UserNewsletterStatus
          subscribed={row.newsletter_subscribed}
          labels={{
            subscribed: labels.statuses.subscribed,
            unsubscribed: labels.statuses.unsubscribed,
          }}
        />
      ),
    },
    {
      key: 'created_at',
      header: labels.joined,
      width: 85,
      minWidth: 85,
      cell: (row) => (
        <Text size="sm" c="dimmed">
          <DateTime value={row.created_at} />
        </Text>
      ),
    },
    {
      key: 'actions',
      kind: 'action',
      header: '',
      width: 50,
      minWidth: 50,
      cell: renderActions,
    },
  ];
}

interface UsersTableViewProps {
  result: ServerDataTableSelectableSectionProps<UserRow>['result'];
  searchPlaceholder: string;
  filterFields: ServerDataTableSelectableSectionProps<UserRow>['filterFields'];
  sortFields: ServerDataTableSelectableSectionProps<UserRow>['sortFields'];
  deleteAction: (id: string) => Promise<{ success?: boolean; error?: string }>;
  renderActions: (row: UserRow) => ReactNode;
}

export function UsersTableView({
  result,
  searchPlaceholder,
  filterFields,
  sortFields,
  deleteAction,
  renderActions,
}: UsersTableViewProps) {
  const tCommon = useTranslations('common');
  const tCommonEntities = useTranslations('common.entities');
  const tAdmin = useTranslations('adminList');
  const columns = getColumns(
    {
      user: tCommon('entities.user'),
      email: tCommon('labels.email'),
      role: tCommon('labels.role'),
      status: tCommon('labels.status'),
      newsletter: tCommon('labels.newsletter'),
      joined: tCommon('labels.joined'),
      roles: {
        admin: tCommon('roles.admin'),
        author: tCommon('roles.author'),
        user: tCommon('roles.user'),
      },
      statuses: {
        active: tCommon('statuses.active'),
        banned: tCommon('statuses.banned'),
        pendingDeletion: tCommon('statuses.pendingDeletion'),
        deleted: tCommon('statuses.deleted'),
        onboardingPending: tCommon('statuses.onboardingPending'),
        subscribed: tCommon('statuses.subscribed'),
        unsubscribed: tCommon('statuses.unsubscribed'),
      },
    },
    renderActions,
  );

  return (
    <ServerDataTableSelectableSection
      namespace="users"
      result={result}
      columns={columns}
      getRowKey={(row) => row.id}
      emptyMessage={tAdmin('users.empty')}
      searchPlaceholder={searchPlaceholder}
      filterFields={filterFields}
      sortFields={sortFields}
      allowFilterLogicToggle={false}
      bulkDelete={{
        entityLabel: tCommonEntities('users'),
        deleteAction,
        getRowLabel: (row) => row.nickname,
      }}
    />
  );
}
