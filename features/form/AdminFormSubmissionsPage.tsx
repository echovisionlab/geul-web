'use client';

import { useEffect, useState } from 'react';
import { IconSearch, IconSortAscending, IconSortDescending, IconTrash, IconX } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Group, Modal, Pagination, Stack, Table, Text } from '@mantine/core';
import { DatePickerInput, type DatesRangeValue } from '@mantine/dates';
import { useDebouncedValue, useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { LabelBadge } from '@/components/core/Badge';
import { Button } from '@/components/core/Button';
import { DateTime } from '@/features/date-time/DateTime';
import { IconButton } from '@/components/core/IconButton';
import { Select, TextInput } from '@/components/core/Input';
import { TextButton } from '@/components/core/TextButton';
import { Tooltip } from '@/components/core/Tooltip';
import { PageLoader } from '@/features/site/PageLoader';
import { deleteFormSubmissionAction, listFormSubmissionsAction } from '@/lib/actions/form';

// Local type for submissions returned from the action (createdAt is optional)
interface SubmissionListItem {
  id: string;
  formId: string;
  memberId: string | undefined;
  data: Record<string, unknown>;
  ipAddress: string | undefined;
  countryCode: string | undefined;
  userAgent: string | undefined;
  createdAt: Date | undefined;
}

export default function AdminFormSubmissionsPage({ formId, editBaseHref }: { formId: string; editBaseHref: string }) {
  const t = useTranslations('formAdmin.submissions');
  const tCommonActions = useTranslations('common.actions');
  const tCommonEntities = useTranslations('common.entities');
  const tCommonLabels = useTranslations('common.labels');
  const tCommonPlaceholders = useTranslations('common.placeholders');
  const tCommonStates = useTranslations('common.states');
  const [page, setPage] = useState(1);
  const limit = 20;

  // Filter states
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [countryFilter, setCountryFilter] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DatesRangeValue>([null, null]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, sortOrder, countryFilter, dateRange]);

  const queryClient = useQueryClient();
  const { data: submissionsData, isLoading: submissionsLoading } = useQuery({
    queryKey: [
      'forms',
      formId,
      'submissions',
      { page, limit, search: debouncedSearch, sortOrder, countryFilter, dateRange },
    ],
    queryFn: () =>
      listFormSubmissionsAction({
        formId,
        page,
        limit,
        search: debouncedSearch || undefined,
        sortBy: 'createdAt',
        sortOrder,
        countryCode: countryFilter || undefined,
        dateFrom: dateRange[0] ? (dateRange[0] instanceof Date ? dateRange[0].toISOString() : dateRange[0]) : undefined,
        dateTo: dateRange[1] ? (dateRange[1] instanceof Date ? dateRange[1].toISOString() : dateRange[1]) : undefined,
      }),
  });

  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);
  const [deleteTarget, setDeleteTarget] = useState<SubmissionListItem | null>(null);

  const deleteSubmission = useMutation({
    mutationFn: (data: { id: string }) => deleteFormSubmissionAction(data.id),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({ message: t('notifications.deleted'), color: 'red' });
      queryClient.invalidateQueries({ queryKey: ['forms', formId, 'submissions'] });
      closeDeleteModal();
      setDeleteTarget(null);
    },
    onError: (error) => {
      notifications.show({ message: error.message, color: 'red' });
    },
  });

  const handleDelete = (submission: SubmissionListItem) => {
    setDeleteTarget(submission);
    openDeleteModal();
  };

  const clearFilters = () => {
    setSearch('');
    setCountryFilter(null);
    setDateRange([null, null]);
  };

  const hasActiveFilters = search || countryFilter || dateRange[0] || dateRange[1];

  if (submissionsLoading) {
    return <PageLoader />;
  }

  const submissions = (submissionsData?.submissions ?? []) as SubmissionListItem[];
  const hasSubmissions = submissions.length > 0;

  // Get unique country codes for filter
  const countryOptions = Array.from(new Set(submissions.map((s) => s.countryCode).filter(Boolean))).map((code) => ({
    value: code!,
    label: code!,
  }));

  return (
    <Stack>
      {/* Filters */}
      <Group gap="sm" wrap="wrap">
        <TextInput
          placeholder={tCommonPlaceholders('search')}
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          style={{ flex: 1, minWidth: 200 }}
          size="sm"
        />
        <Select
          placeholder={tCommonLabels('country')}
          data={countryOptions}
          value={countryFilter}
          onChange={setCountryFilter}
          clearable
          size="sm"
          w={120}
        />
        <DatePickerInput
          type="range"
          placeholder={t('dateRangePlaceholder')}
          value={dateRange}
          onChange={setDateRange}
          clearable
          size="sm"
          w={220}
        />
        <Tooltip label={sortOrder === 'desc' ? t('newestFirst') : t('oldestFirst')}>
          <IconButton
            emphasis="medium"
            aria-label={sortOrder === 'desc' ? t('newestFirst') : t('oldestFirst')}
            onClick={() => setSortOrder((o) => (o === 'desc' ? 'asc' : 'desc'))}
            size="lg"
          >
            {sortOrder === 'desc' ? <IconSortDescending size={16} /> : <IconSortAscending size={16} />}
          </IconButton>
        </Tooltip>
        {hasActiveFilters && (
          <IconButton
            tone="neutral"
            emphasis="low"
            onClick={clearFilters}
            title={t('clearFilters')}
            aria-label={t('clearFilters')}
            size="lg"
          >
            <IconX size={16} />
          </IconButton>
        )}
      </Group>

      {/* Results count */}
      <Text size="sm" c="dimmed">
        {t('count', { count: submissionsData?.total ?? 0 })}
        {hasActiveFilters ? ` ${t('filteredSuffix')}` : ''}
      </Text>

      <Table highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{tCommonLabels('id')}</Table.Th>
            <Table.Th>{t('table.submitted')}</Table.Th>
            <Table.Th>{tCommonLabels('country')}</Table.Th>
            <Table.Th>{tCommonEntities('user')}</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {!hasSubmissions && (
            <Table.Tr>
              <Table.Td colSpan={5}>
                <Text c="dimmed" ta="center" py="xl">
                  {hasActiveFilters ? t('emptyFiltered') : t('empty')}
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
          {submissions.map((submission) => (
            <Table.Tr key={submission.id}>
              <Table.Td>
                <TextButton
                  href={`${editBaseHref}&submission=${encodeURIComponent(submission.id)}`}
                  size="sm"
                  appearance="accent"
                  style={{ fontFamily: 'monospace' }}
                >
                  {submission.id.slice(0, 8)}
                </TextButton>
              </Table.Td>
              <Table.Td>
                <Text size="sm">
                  <DateTime value={submission.createdAt} display="dateTime" />
                </Text>
              </Table.Td>
              <Table.Td>
                <LabelBadge size="sm">{submission.countryCode ?? '-'}</LabelBadge>
              </Table.Td>
              <Table.Td>
                <Text size="sm" c="dimmed">
                  {submission.memberId ?? tCommonStates('anonymous')}
                </Text>
              </Table.Td>
              <Table.Td>
                <IconButton
                  tone="danger"
                  emphasis="low"
                  onClick={() => handleDelete(submission)}
                  aria-label={t('actions.deleteSubmission')}
                >
                  <IconTrash size={16} />
                </IconButton>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      {submissionsData && submissionsData.totalPages > 1 && (
        <Group justify="center">
          <Pagination value={page} onChange={setPage} total={submissionsData.totalPages} />
        </Group>
      )}

      {/* Delete Modal */}
      <Modal opened={deleteModalOpened} onClose={closeDeleteModal} title={t('deleteModal.title')}>
        <Stack>
          <Text>{t('deleteModal.body')}</Text>
          <Group justify="flex-end">
            <Button emphasis="low" onClick={closeDeleteModal}>
              {tCommonActions('cancel')}
            </Button>
            <Button
              tone="danger"
              onClick={() => deleteTarget && deleteSubmission.mutate({ id: deleteTarget.id })}
              loading={deleteSubmission.isPending}
            >
              {tCommonActions('delete')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
