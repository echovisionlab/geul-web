'use client';

import { useState } from 'react';
import { IconX } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Box, Divider, Group, Stack, Table, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { Button } from '@/components/core/Button';
import { IconButton } from '@/components/core/IconButton';
import { SegmentedControl, Select, TextInput } from '@/components/core/Input';
import { listArtistsAction } from '@/lib/actions/artist';
import { setTrackCreditsAction } from '@/lib/actions/track';
import { listUsersAdminAction } from '@/lib/actions/user';
import type { ReleaseTrackItem } from '@/lib/collab/schemas/release-fields.schema';
import type { CreditTargetType } from '@/lib/types/track/model';
import { toTrackCreditMutationInput } from './track-credit-mutation';

interface TrackCreditsEditorSectionProps {
  idPrefix?: string;
  trackId: string;
  credits: ReleaseTrackItem['credits'];
  onCreditsChange: (credits: ReleaseTrackItem['credits']) => void;
}

export function TrackCreditsEditorSection({
  idPrefix,
  trackId,
  credits,
  onCreditsChange,
}: TrackCreditsEditorSectionProps) {
  const tCommon = useTranslations('common');
  const tTracks = useTranslations('releaseEditor.tracks');
  const tCredits = useTranslations('releaseEditor.credits');
  const isMobile = useMediaQuery('(max-width: 48em)');
  const [creditType, setCreditType] = useState<CreditTargetType>('artist');
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [creditedName, setCreditedName] = useState('');
  const [creditRole, setCreditRole] = useState('');
  const { data: allArtists = [] } = useQuery({ queryKey: ['artist', 'list'], queryFn: listArtistsAction });
  const { data: members } = useQuery({ queryKey: ['member', 'listAdmin'], queryFn: () => listUsersAdminAction({}) });
  const allMembers = (members?.data ?? []).map((member) => ({ id: member.id, name: member.nickname }));

  const setCredits = useMutation({
    mutationFn: (nextCredits: ReleaseTrackItem['credits']) =>
      setTrackCreditsAction(trackId, toTrackCreditMutationInput(nextCredits)),
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
      onSuccess: (result) => {
        if (result.error) {
          notifications.show({ message: result.error, color: 'red' });
          return;
        }
        notifications.show({ message: successMessage, color: 'green' });
        onCreditsChange(nextCredits);
        onSuccess?.();
      },
    });
  };

  const handleAddCredit = () => {
    let newCredit: ReleaseTrackItem['credits'][number] | null = null;

    if (creditType === 'artist' && selectedArtistId) {
      const artist = allArtists.find((item) => item.id === selectedArtistId);
      if (!artist) {
        return;
      }
      if (credits.some((credit) => credit.artist_id === selectedArtistId && credit.credit_role === creditRole)) {
        notifications.show({ message: tCredits('duplicate'), color: 'yellow' });
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
        notifications.show({ message: tCredits('duplicate'), color: 'yellow' });
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
    persistCredits(
      [...credits, newCredit],
      tCommon('messages.itemUpdated', { item: tCommon('entities.credits') }),
      resetForm,
    );
  };

  const handleRemoveCredit = (creditId: string) => {
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
      tone="danger"
      emphasis="low"
      size="sm"
      aria-label={tCommon('actions.remove')}
      onClick={() => handleRemoveCredit(credit.id)}
    >
      <IconX size={14} />
    </IconButton>
  );

  return (
    <Stack gap="sm">
      <Text size="sm" fw={500}>
        {tTracks('creditsModal.title')}
      </Text>
      {credits.length === 0 ? (
        <Text size="sm" c="dimmed">
          {tTracks('creditsModal.empty')}
        </Text>
      ) : isMobile ? (
        <Stack gap={0}>
          {credits.map((credit, index) => (
            <Box key={credit.id} py="sm">
              <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
                <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                  <Text size="sm">{getCreditDisplayName(credit)}</Text>
                  <Text size="sm" c="dimmed">
                    {credit.credit_role || '-'}
                  </Text>
                </Stack>
                {removeButton(credit)}
              </Group>
              {index < credits.length - 1 ? <Divider mt="sm" /> : null}
            </Box>
          ))}
        </Stack>
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
                  <Text size="sm">{getCreditDisplayName(credit)}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {credit.credit_role || '-'}
                  </Text>
                </Table.Td>
                <Table.Td>{removeButton(credit)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Divider />

      <Stack gap="xs">
        <Text size="sm" fw={500}>
          {tCommon('actions.addItem', { item: tCommon('entities.credit') })}
        </Text>
        <SegmentedControl
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
        <Stack gap="sm">
          {creditType === 'artist' ? (
            <Select
              id={idPrefix ? `${idPrefix}-track-credit-artist-${trackId}` : undefined}
              placeholder={tCredits('placeholders.selectArtist')}
              data={allArtists.map((artist) => ({ value: artist.id, label: artist.name }))}
              value={selectedArtistId}
              onChange={setSelectedArtistId}
              searchable
              size="sm"
            />
          ) : null}
          {creditType === 'member' ? (
            <Select
              id={idPrefix ? `${idPrefix}-track-credit-member-${trackId}` : undefined}
              placeholder={tCredits('placeholders.selectUser')}
              data={allMembers.map((member) => ({ value: member.id, label: member.name }))}
              value={selectedMemberId}
              onChange={setSelectedMemberId}
              searchable
              size="sm"
            />
          ) : null}
          {creditType === 'text' ? (
            <TextInput
              id={idPrefix ? `${idPrefix}-track-credit-name-${trackId}` : undefined}
              placeholder={tCredits('placeholders.creditedName')}
              value={creditedName}
              onChange={(event) => setCreditedName(event.currentTarget.value)}
              size="sm"
            />
          ) : null}
          <TextInput
            id={idPrefix ? `${idPrefix}-track-credit-role-${trackId}` : undefined}
            placeholder={tCredits('placeholders.role')}
            value={creditRole}
            onChange={(event) => setCreditRole(event.currentTarget.value)}
            size="sm"
          />
        </Stack>
        <Group justify="flex-end">
          <Button size="sm" onClick={handleAddCredit} disabled={isAddDisabled} loading={setCredits.isPending}>
            {tCommon('actions.add')}
          </Button>
        </Group>
      </Stack>
    </Stack>
  );
}
