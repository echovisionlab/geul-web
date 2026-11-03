'use client';
import { SupportingText, Text as DsText, VisuallyHidden } from '@/components/core/Typography';

import { ConfirmationDialog } from '@/features/confirmation';

import {
  LayoutStack as DsLayoutStack,
  LayoutInline as DsLayoutInline,
  LayoutInset as DsLayoutInset,
} from '@/components/core/Layout';

import { useEffect, useState } from 'react';
import { IconSortAscending, IconSortDescending, IconTrash, IconX } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { Pagination, Table } from '@/components/core/Display';
import { DateRangeInput, type DatesRangeValue, SearchInput, Select } from '@/components/core/Input';
import { useDebouncedValue, useDisclosure } from '@mantine/hooks';
import { notifications } from '@/components/core/Notification';
import { LabelBadge } from '@/components/core/Badge';
import { Button } from '@/components/core/Button';
import { DateTime } from '@/features/date-time/DateTime';
import { IconButton } from '@/components/core/IconButton';

import { TextButton } from '@/components/core/TextButton';
import { Tooltip } from '@/components/core/Tooltip';
import { PageLoader } from '@/features/site/PageLoader';
import { deleteFormSubmissionAction, listFormSubmissionsAction } from '@/lib/actions/form';
import { getSubmissionDateRangeBounds } from './submission-date-range';
import { buildSubmissionHref } from './submission-href';

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

export interface AdminFormSubmissionsPageProps {
  formId: string;
  editBaseHref: string;
  listAction?: typeof listFormSubmissionsAction;
  deleteAction?: typeof deleteFormSubmissionAction;
}
export default function AdminFormSubmissionsPage({
  formId,
  editBaseHref,
  listAction = listFormSubmissionsAction,
  deleteAction = deleteFormSubmissionAction,
}: AdminFormSubmissionsPageProps) {
  const tPagination = useTranslations('dataTable.pagination');
  const tModalActions = useTranslations('common.actions');
  const t = useTranslations('formAdmin.submissions');
  const tCommonActions = useTranslations('common.actions');
  const tCommonEntities = useTranslations('common.entities');
  const tCommonErrors = useTranslations('common.errors');
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
  const {
    data: submissionsData,
    isLoading: submissionsLoading,
    isError: submissionsFailed,
    isFetching: submissionsFetching,
    refetch: refetchSubmissions,
  } = useQuery({
    queryKey: [
      'forms',
      formId,
      'submissions',
      { page, limit, search: debouncedSearch, sortOrder, countryFilter, dateRange },
    ],
    queryFn: async () => {
      const dateBounds = getSubmissionDateRangeBounds(dateRange);
      const result = await listAction({
        formId,
        page,
        limit,
        search: debouncedSearch || undefined,
        sortBy: 'createdAt',
        sortOrder,
        countryCode: countryFilter || undefined,
        ...dateBounds,
      });
      if (!result.ok) {
        throw new Error(result.code);
      }
      return result.data;
    },
  });

  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);
  const [deleteTarget, setDeleteTarget] = useState<SubmissionListItem | null>(null);

  const deleteSubmission = useMutation({
    mutationFn: (data: { id: string }) => deleteAction(data.id),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: t('notifications.deleted'), tone: 'positive' });
      queryClient.invalidateQueries({ queryKey: ['forms', formId, 'submissions'] });
      closeDeleteModal();
      setDeleteTarget(null);
    },
    onError: (error) => {
      notifications.show({ message: error.message, tone: 'danger' });
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
    return <PageLoader placement="flow" />;
  }

  if (submissionsFailed) {
    return (
      <DsLayoutStack role="alert" align="center" gap="sm">
        <DsText size="sm" tone="danger">
          {tCommonErrors('generic')}
        </DsText>
        <Button
          emphasis="low"
          loading={submissionsFetching}
          disabled={submissionsFetching}
          onClick={() => void refetchSubmissions()}
        >
          {tCommonActions('tryAgain')}
        </Button>
      </DsLayoutStack>
    );
  }

  const submissions = (submissionsData?.submissions ?? []) as SubmissionListItem[];
  const hasSubmissions = submissions.length > 0;

  // Get unique country codes for filter
  const countryOptions = Array.from(new Set(submissions.map((s) => s.countryCode).filter(Boolean))).map((code) => ({
    value: code!,
    label: code!,
  }));

  return (
    <DsLayoutStack>
      {/* Filters */}
      <DsLayoutInline gap="sm" wrap="wrap">
        <div style={{ minWidth: 200, flex: 1 }}>
          <SearchInput
            grow
            aria-label={tCommonPlaceholders('search')}
            placeholder={tCommonPlaceholders('search')}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            size="sm"
          />
        </div>
        <div style={{ width: 120 }}>
          <Select
            aria-label={tCommonLabels('country')}
            placeholder={tCommonLabels('country')}
            data={countryOptions}
            value={countryFilter}
            onChange={setCountryFilter}
            clearable
            size="sm"
          />
        </div>
        <div style={{ width: 220 }}>
          <DateRangeInput
            aria-label={t('dateRangePlaceholder')}
            placeholder={t('dateRangePlaceholder')}
            value={dateRange}
            onChange={setDateRange}
            clearable
            size="sm"
          />
        </div>
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
      </DsLayoutInline>

      {/* Results count */}
      <SupportingText role="status" aria-live="polite" aria-atomic="true" tone="secondary">
        {t('count', { count: submissionsData?.total ?? 0 })}
        {hasActiveFilters ? ` ${t('filteredSuffix')}` : ''}
      </SupportingText>

      <Table.ScrollContainer minWidth={640} role="region" aria-label={tCommonLabels('submissions')} tabIndex={0}>
        <Table highlightOnHover aria-label={tCommonLabels('submissions')} aria-busy={submissionsFetching}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{tCommonLabels('id')}</Table.Th>
              <Table.Th>{t('table.submitted')}</Table.Th>
              <Table.Th>{tCommonLabels('country')}</Table.Th>
              <Table.Th>{tCommonEntities('user')}</Table.Th>
              <Table.Th>
                <VisuallyHidden>{tCommonLabels('actions')}</VisuallyHidden>
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {!hasSubmissions && (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <DsLayoutInset block="xl">
                    <SupportingText tone="secondary" align="center">
                      {hasActiveFilters ? t('emptyFiltered') : t('empty')}
                    </SupportingText>
                  </DsLayoutInset>
                </Table.Td>
              </Table.Tr>
            )}
            {submissions.map((submission) => (
              <Table.Tr key={submission.id}>
                <Table.Td>
                  <TextButton
                    id={`submission-${submission.id}`}
                    href={buildSubmissionHref(editBaseHref, submission.id)}
                    size="sm"
                    appearance="accent"
                    font="mono"
                  >
                    {submission.id.slice(0, 8)}
                  </TextButton>
                </Table.Td>
                <Table.Td>
                  <DsText size="sm">
                    <DateTime value={submission.createdAt} display="dateTime" />
                  </DsText>
                </Table.Td>
                <Table.Td>
                  <LabelBadge size="sm">{submission.countryCode ?? '-'}</LabelBadge>
                </Table.Td>
                <Table.Td>
                  <DsText size="sm" tone="secondary">
                    {submission.memberId ?? tCommonStates('anonymous')}
                  </DsText>
                </Table.Td>
                <Table.Td>
                  <IconButton
                    tone="danger"
                    emphasis="low"
                    onClick={() => handleDelete(submission)}
                    aria-label={t('actions.deleteSubmission')}
                    aria-describedby={`submission-${submission.id}`}
                  >
                    <IconTrash size={16} />
                  </IconButton>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      {submissionsData && submissionsData.totalPages > 1 && (
        <DsLayoutInline justify="center">
          <Pagination
            value={page}
            onChange={setPage}
            total={submissionsData.totalPages}
            labels={{
              previousPage: tPagination('previousPage'),
              nextPage: tPagination('nextPage'),
              page: (page) => tPagination('page', { page }),
            }}
          />
        </DsLayoutInline>
      )}

      {/* Delete Modal */}
      <ConfirmationDialog
        intent="delete"
        opened={deleteModalOpened}
        onClose={closeDeleteModal}
        onConfirm={() => deleteTarget && deleteSubmission.mutate({ id: deleteTarget.id })}
        title={t('deleteModal.title')}
        confirmLabel={tCommonActions('delete')}
        cancelLabel={tCommonActions('cancel')}
        closeLabel={tModalActions('close')}
        loading={deleteSubmission.isPending}
        message={
          <>
            <DsText>{t('deleteModal.body')}</DsText>
          </>
        }
      />
    </DsLayoutStack>
  );
}
