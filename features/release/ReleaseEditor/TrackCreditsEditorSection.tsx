'use client';
import { InputValidationGlyph } from '@/components/core/Input/InputGlyphs';
import { useReleaseEditorCanEdit } from './ReleaseEditorAccessContext';
import { breakpointQuery } from '@/components/core/Layout/breakpoints';
import { SupportingText, Text as DsText } from '@/components/core/Typography';

import {
  LayoutStack as DsLayoutStack,
  LayoutInline as DsLayoutInline,
  LayoutInset as DsLayoutInset,
} from '@/components/core/Layout';

import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';
import { unwrapQueryResult } from '@/lib/api/query-result';

import { useId, useState } from 'react';
import { IconX } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { Separator as Divider, Table } from '@/components/core/Display';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@/components/core/Notification';
import { Button } from '@/components/core/Button';
import { IconButton } from '@/components/core/IconButton';
import { SegmentedControl, Select, TextInput } from '@/components/core/Input';
import { listArtistsAction } from '@/lib/actions/artist';
import { setTrackCreditsAction } from '@/lib/actions/track';
import { getUntrackedConfigurationWriteOrigin } from '@/lib/editor/editor-write-origin';
import { publishEditorEntityChange } from '@/lib/editor/editor-entity-changes';
import { listUsersAdminAction } from '@/lib/actions/user';
import type { ReleaseTrackItem } from '@/lib/collab/schemas/release-fields.schema';
import type { CreditTargetType } from '@/lib/types/track/model';
import { toTrackCreditMutationInput } from './track-credit-mutation';

interface TrackCreditsEditorSectionProps {
  releaseId: string;
  idPrefix?: string;
  trackId: string;
  credits: ReleaseTrackItem['credits'];
  onCreditsChange: (credits: ReleaseTrackItem['credits']) => void;
  onMutationStart?: () => string | void;
  onMutationSettled?: (succeeded: boolean) => void;
}

export function TrackCreditsEditorSection({
  releaseId,
  idPrefix,
  trackId,
  credits,
  onCreditsChange,
  onMutationStart,
  onMutationSettled,
}: TrackCreditsEditorSectionProps) {
  const canEdit = useReleaseEditorCanEdit();
  const tCommon = useTranslations('common');
  const tTracks = useTranslations('releaseEditor.tracks');
  const tCredits = useTranslations('releaseEditor.credits');
  const isMobile = useMediaQuery(breakpointQuery('sm'));
  const [creditType, setCreditType] = useState<CreditTargetType>('artist');
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [creditedName, setCreditedName] = useState('');
  const [creditRole, setCreditRole] = useState('');
  const creditsId = useId();
  const [pendingCommand, setPendingCommand] = useState<string | null>(null);
  const allArtistsQuery = useQuery({
    queryKey: ['artist', 'list'],
    queryFn: () => listArtistsAction().then(unwrapQueryResult),
  });
  const { data: allArtists = [] } = allArtistsQuery;
  const membersQuery = useQuery({
    queryKey: ['member', 'listAdmin'],
    queryFn: () => listUsersAdminAction({}).then(unwrapQueryResult),
  });
  const { data: members } = membersQuery;
  const allMembers = (members?.data ?? []).map((member) => ({ id: member.id, name: member.nickname }));

  const setCredits = useMutation({
    mutationFn: async (nextCredits: ReleaseTrackItem['credits']) => {
      const editorOrigin = onMutationStart?.() || getUntrackedConfigurationWriteOrigin(`release:${releaseId}`);
      const result = await setTrackCreditsAction(
        trackId,
        toTrackCreditMutationInput(nextCredits),
        toTrackCreditMutationInput(credits),
        editorOrigin,
      );
      if (result.success && !result.error) {
        publishEditorEntityChange(`release:${releaseId}`, editorOrigin);
      }
      return result;
    },
    onSettled: (result, error) => onMutationSettled?.(!error && Boolean(result?.success) && !result?.error),
  });

  const resetForm = () => {
    setCreditType('artist');
    setSelectedArtistId(null);
    setSelectedMemberId(null);
    setCreditedName('');
    setCreditRole('');
  };

  const persistCredits = (nextCredits: ReleaseTrackItem['credits'], successMessage: string, onSuccess?: () => void) => {
    setCredits.mutate(nextCredits, {
      onSettled: () => setPendingCommand(null),
      onError: () => notifications.show({ message: tCommon('notifications.saveFailed'), tone: 'danger' }),
      onSuccess: (result) => {
        if (result.error) {
          notifications.show({ message: result.error, tone: 'danger' });
          return;
        }
        notifications.show({ message: successMessage, tone: 'positive' });
        onCreditsChange(nextCredits);
        onSuccess?.();
      },
    });
  };

  const handleAddCredit = () => {
    if (!canEdit || setCredits.isPending) {
      return;
    }
    let newCredit: ReleaseTrackItem['credits'][number] | null = null;

    if (creditType === 'artist' && selectedArtistId) {
      const artist = allArtists.find((item) => item.id === selectedArtistId);
      if (!artist) {
        return;
      }
      if (credits.some((credit) => credit.artist_id === selectedArtistId && credit.credit_role === creditRole)) {
        notifications.show({ message: tCredits('duplicate'), tone: 'warning' });
        return;
      }
      newCredit = {
        id: '',
        credit_type: 'artist',
        artist_id: artist.id,
        artist_name: artist.name,
        artist_slug: artist.slug,
        member_id: null,
        member_name: null,
        credited_name: null,
        credit_role: creditRole || null,
        sort_order: credits.length,
      };
    } else if (creditType === 'member' && selectedMemberId) {
      const member = allMembers.find((item) => item.id === selectedMemberId);
      if (!member) {
        return;
      }
      if (credits.some((credit) => credit.member_id === selectedMemberId && credit.credit_role === creditRole)) {
        notifications.show({ message: tCredits('duplicate'), tone: 'warning' });
        return;
      }
      newCredit = {
        id: '',
        credit_type: 'member',
        artist_id: null,
        artist_name: null,
        artist_slug: null,
        member_id: member.id,
        member_name: member.name,
        credited_name: null,
        credit_role: creditRole || null,
        sort_order: credits.length,
      };
    } else if (creditType === 'text' && creditedName.trim()) {
      newCredit = {
        id: '',
        credit_type: 'text',
        artist_id: null,
        artist_name: null,
        artist_slug: null,
        member_id: null,
        member_name: null,
        credited_name: creditedName.trim(),
        credit_role: creditRole || null,
        sort_order: credits.length,
      };
    }

    if (!newCredit) {
      return;
    }
    setPendingCommand('add');
    persistCredits(
      [...credits, newCredit],
      tCommon('messages.itemUpdated', { item: tCommon('entities.credits') }),
      resetForm,
    );
  };

  const handleRemoveCredit = (creditId: string) => {
    if (!canEdit || setCredits.isPending) {
      return;
    }
    setPendingCommand(creditId);
    persistCredits(
      credits.filter((credit) => credit.id !== creditId),
      tCommon('messages.itemRemoved', { item: tCommon('entities.credit') }),
    );
  };

  const getCreditDisplayName = (credit: ReleaseTrackItem['credits'][number]) =>
    (credit.artist_id && credit.artist_name) ||
    (credit.member_id && credit.member_name) ||
    credit.credited_name ||
    tCommon('states.unknown');

  const isAddDisabled =
    (creditType === 'artist' && !selectedArtistId) ||
    (creditType === 'member' && !selectedMemberId) ||
    (creditType === 'text' && !creditedName.trim());

  const removeButton = (credit: ReleaseTrackItem['credits'][number]) => (
    <IconButton
      disabled={!canEdit || setCredits.isPending}
      loading={setCredits.isPending && pendingCommand === credit.id}
      tone="danger"
      emphasis="low"
      size="sm"
      aria-label={tCommon('actions.remove')}
      aria-describedby={`${creditsId}-${credit.id}`}
      onClick={() => handleRemoveCredit(credit.id)}
    >
      <IconX size={14} />
    </IconButton>
  );

  return (
    <DsLayoutStack gap="md">
      <QueryErrorAlert queries={[allArtistsQuery, membersQuery]} />
      <DsText size="sm" weight="medium">
        {tTracks('creditsModal.title')}
      </DsText>
      {credits.length === 0 ? (
        <SupportingText tone="secondary">{tTracks('creditsModal.empty')}</SupportingText>
      ) : isMobile ? (
        <DsLayoutStack gap="none">
          {credits.map((credit, index) => (
            <DsLayoutInset key={credit.id} block="sm">
              <DsLayoutInset space="none">
                <DsLayoutInline justify="between" align="start" wrap="nowrap" gap="sm">
                  <DsLayoutStack gap="xxs" flexible>
                    <DsText id={`${creditsId}-${credit.id}`} size="sm">
                      {getCreditDisplayName(credit)}
                    </DsText>
                    <DsText size="sm" tone="secondary">
                      {credit.credit_role || '-'}
                    </DsText>
                  </DsLayoutStack>
                  {removeButton(credit)}
                </DsLayoutInline>
                {index < credits.length - 1 ? <Divider spaceBefore="sm" /> : null}
              </DsLayoutInset>
            </DsLayoutInset>
          ))}
        </DsLayoutStack>
      ) : (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{tCommon('labels.name')}</Table.Th>
              <Table.Th>{tCommon('labels.role')}</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {credits.map((credit) => (
              <Table.Tr key={credit.id}>
                <Table.Td>
                  <DsText id={`${creditsId}-${credit.id}`} size="sm">
                    {getCreditDisplayName(credit)}
                  </DsText>
                </Table.Td>
                <Table.Td>
                  <DsText size="sm" tone="secondary">
                    {credit.credit_role || '-'}
                  </DsText>
                </Table.Td>
                <Table.Td>{removeButton(credit)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <DsLayoutStack gap="xs">
        <DsText size="sm" weight="medium">
          {tCommon('actions.addItem', { item: tCommon('entities.credit') })}
        </DsText>
        <SegmentedControl
          disabled={!canEdit || setCredits.isPending}
          aria-label={tCommon('entities.credit')}
          id={idPrefix ? `${idPrefix}-track-credit-type-${trackId}` : undefined}
          value={creditType}
          onChange={(value) => setCreditType(value as CreditTargetType)}
          data={[
            { value: 'artist', label: tCommon('entities.artist') },
            { value: 'member', label: tCommon('entities.member') },
            { value: 'text', label: tCommon('labels.text') },
          ]}
          size="xs"
          fullWidth
        />
        <DsLayoutStack gap="sm">
          {creditType === 'artist' ? (
            <Select
              disabled={!canEdit || setCredits.isPending}
              aria-label={tCommon('entities.artist')}
              id={idPrefix ? `${idPrefix}-track-credit-artist-${trackId}` : undefined}
              placeholder={tCredits('placeholders.selectArtist')}
              aria-busy={allArtistsQuery.isFetching || undefined}
              rightSection={allArtistsQuery.isFetching ? <InputValidationGlyph status="checking" /> : undefined}
              data={allArtists.map((artist) => ({ value: artist.id, label: artist.name }))}
              value={selectedArtistId}
              onChange={setSelectedArtistId}
              searchable
              size="sm"
            />
          ) : null}
          {creditType === 'member' ? (
            <Select
              disabled={!canEdit || setCredits.isPending}
              aria-label={tCommon('entities.member')}
              id={idPrefix ? `${idPrefix}-track-credit-member-${trackId}` : undefined}
              placeholder={tCredits('placeholders.selectUser')}
              aria-busy={membersQuery.isFetching || undefined}
              rightSection={membersQuery.isFetching ? <InputValidationGlyph status="checking" /> : undefined}
              data={allMembers.map((member) => ({ value: member.id, label: member.name }))}
              value={selectedMemberId}
              onChange={setSelectedMemberId}
              searchable
              size="sm"
            />
          ) : null}
          {creditType === 'text' ? (
            <TextInput
              disabled={!canEdit || setCredits.isPending}
              aria-label={tCommon('labels.name')}
              id={idPrefix ? `${idPrefix}-track-credit-name-${trackId}` : undefined}
              placeholder={tCredits('placeholders.creditedName')}
              value={creditedName}
              onChange={(event) => setCreditedName(event.currentTarget.value)}
              size="sm"
            />
          ) : null}
          <TextInput
            disabled={!canEdit || setCredits.isPending}
            aria-label={tCommon('labels.role')}
            id={idPrefix ? `${idPrefix}-track-credit-role-${trackId}` : undefined}
            placeholder={tCredits('placeholders.role')}
            value={creditRole}
            onChange={(event) => setCreditRole(event.currentTarget.value)}
            size="sm"
          />
        </DsLayoutStack>
        <DsLayoutInline justify="end">
          <Button
            emphasis="medium"
            size="sm"
            onClick={handleAddCredit}
            disabled={!canEdit || isAddDisabled}
            loading={setCredits.isPending && pendingCommand === 'add'}
          >
            {tCommon('actions.add')}
          </Button>
        </DsLayoutInline>
      </DsLayoutStack>
    </DsLayoutStack>
  );
}
