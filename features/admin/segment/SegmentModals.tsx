'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SegmentType } from '@echovisionlab/geul-proto/secure/audience_pb.ts';
import { useTranslations } from 'next-intl';
import { Loader, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Select, TextInput } from '@/components/core/Input';
import { ConfirmModal, FormModal } from '@/components/core/Modal';
import {
  createSegmentAction,
  archiveSegmentAction,
  estimateSegmentCountAction,
  getSegmentAction,
  restoreSegmentAction,
  updateSegmentAction,
} from '@/lib/actions/audience';
import { buildSegmentConfig, createEmptyConfig, type SegmentConfigState } from './SegmentConfig';
import { SegmentConfigFields } from './SegmentConfigFields';
import { useSegmentModal } from './SegmentModalContext';

export function SegmentModals() {
  const tCommon = useTranslations('common');
  const tCommonEntities = useTranslations('common.entities');
  const tPage = useTranslations('adminList.audienceSegments');
  const router = useRouter();
  const { lifecycleSegment, lifecycleAction, closeLifecycle, isCreateOpen, closeCreate, editingSegmentId, closeEdit } =
    useSegmentModal();

  // Create modal state
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createType, setCreateType] = useState<string | null>(null);
  const [createConfig, setCreateConfig] = useState<SegmentConfigState>(createEmptyConfig());
  const [createLoading, setCreateLoading] = useState(false);
  const [createEstimatedCount, setCreateEstimatedCount] = useState<number | null>(null);
  const [createEstimateLoading, setCreateEstimateLoading] = useState(false);

  // Edit modal state
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editType, setEditType] = useState<string | null>(null);
  const [editConfig, setEditConfig] = useState<SegmentConfigState>(createEmptyConfig());
  const [editLoading, setEditLoading] = useState(false);
  const [editFetchLoading, setEditFetchLoading] = useState(false);
  const [editEstimatedCount, setEditEstimatedCount] = useState<number | null>(null);
  const [editEstimateLoading, setEditEstimateLoading] = useState(false);

  const [lifecycleLoading, setLifecycleLoading] = useState(false);
  const segmentTypeOptions = [
    { value: String(SegmentType.ALL_MEMBERS), label: tPage('types.allUsers') },
    { value: String(SegmentType.MEMBER_TAGS), label: tCommonEntities('userTags') },
    { value: String(SegmentType.MEMBERS_BY_FILTER), label: tPage('types.usersByFilter') },
  ];

  // Reset create modal
  useEffect(() => {
    if (!isCreateOpen) {
      setCreateName('');
      setCreateDescription('');
      setCreateType(null);
      setCreateConfig(createEmptyConfig());
      setCreateEstimatedCount(null);
    }
  }, [isCreateOpen]);

  // Reset config when create type changes
  const handleCreateTypeChange = useCallback((value: string | null) => {
    setCreateType(value);
    setCreateConfig(createEmptyConfig());
    setCreateEstimatedCount(null);
  }, []);

  // Load segment data for edit
  useEffect(() => {
    if (!editingSegmentId) {
      setEditName('');
      setEditDescription('');
      setEditType(null);
      setEditConfig(createEmptyConfig());
      setEditEstimatedCount(null);
      return;
    }
    setEditFetchLoading(true);
    getSegmentAction(editingSegmentId)
      .then((result) => {
        if (result.data) {
          setEditName(result.data.name);
          setEditDescription(result.data.description);
          setEditType(String(result.data.segmentType));
          setEditConfig({
            memberTagIds: result.data.config.memberTagIds,
            accountRoles: result.data.config.accountRoles,
            createdAfter: result.data.config.createdAfter ?? '',
            createdBefore: result.data.config.createdBefore ?? '',
          });
          setEditEstimatedCount(result.data.estimatedCount);
        } else {
          notifications.show({ message: result.error ?? tPage('loading'), color: 'red' });
          closeEdit();
        }
      })
      .finally(() => setEditFetchLoading(false));
  }, [editingSegmentId, closeEdit]);

  // Reset config when edit type changes
  const handleEditTypeChange = useCallback(
    (value: string | null) => {
      setEditType(value);
      // Only reset config if type actually changed
      if (value !== String(editType)) {
        setEditConfig(createEmptyConfig());
        setEditEstimatedCount(null);
      }
    },
    [editType],
  );

  const handleEstimate = useCallback(
    async (
      type: string | null,
      config: SegmentConfigState,
      setCount: (count: number | null) => void,
      setLoading: (loading: boolean) => void,
    ) => {
      if (!type) {
        return;
      }
      setLoading(true);
      try {
        const segmentType = Number(type) as SegmentType;
        const result = await estimateSegmentCountAction({
          segmentType,
          config: buildSegmentConfig(segmentType, config),
        });
        if (result.error) {
          notifications.show({ message: result.error, color: 'red' });
        } else {
          setCount(result.count ?? null);
        }
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const handleCreate = async () => {
    if (!createType) {
      return;
    }
    setCreateLoading(true);
    try {
      const segmentType = Number(createType) as SegmentType;
      const result = await createSegmentAction({
        name: createName,
        description: createDescription || undefined,
        segmentType,
        config: buildSegmentConfig(segmentType, createConfig),
      });
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({ message: tPage('created'), color: 'green' });
      closeCreate();
      router.refresh();
    } finally {
      setCreateLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingSegmentId || !editType) {
      return;
    }
    setEditLoading(true);
    try {
      const segmentType = Number(editType) as SegmentType;
      const result = await updateSegmentAction({
        id: editingSegmentId,
        name: editName,
        description: editDescription || undefined,
        segmentType,
        config: buildSegmentConfig(segmentType, editConfig),
      });
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({ message: tPage('updated'), color: 'green' });
      closeEdit();
      router.refresh();
    } finally {
      setEditLoading(false);
    }
  };

  const handleLifecycleChange = async () => {
    if (!lifecycleSegment || !lifecycleAction) {
      return;
    }
    setLifecycleLoading(true);
    try {
      const result =
        lifecycleAction === 'archive'
          ? await archiveSegmentAction(lifecycleSegment.id)
          : await restoreSegmentAction(lifecycleSegment.id);
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({
        message: tPage(lifecycleAction === 'archive' ? 'archived' : 'restored'),
        color: lifecycleAction === 'archive' ? 'yellow' : 'green',
      });
      closeLifecycle();
      router.refresh();
    } finally {
      setLifecycleLoading(false);
    }
  };

  return (
    <>
      {/* Create Modal */}
      <FormModal
        opened={isCreateOpen}
        onClose={closeCreate}
        onSubmit={handleCreate}
        title={tPage('createTitle')}
        submitLabel={tCommon('actions.createItem', { item: tCommon('entities.audienceSegment') })}
        cancelLabel={tCommon('actions.cancel')}
        closeLabel={tCommon('actions.close')}
        loading={createLoading}
        submitDisabled={!createName.trim() || !createType}
      >
        <TextInput
          label={tCommon('labels.name')}
          placeholder={tPage('namePlaceholder')}
          value={createName}
          onChange={(e) => setCreateName(e.currentTarget.value)}
          required
        />
        <TextInput
          label={tCommon('labels.description')}
          placeholder={tCommon('placeholders.optionalDescription')}
          value={createDescription}
          onChange={(e) => setCreateDescription(e.currentTarget.value)}
          mt="sm"
        />
        <Select
          label={tCommon('labels.type')}
          placeholder={tPage('typePlaceholder')}
          data={segmentTypeOptions}
          value={createType}
          onChange={handleCreateTypeChange}
          required
          mt="sm"
        />
        <SegmentConfigFields
          segmentType={createType ? (Number(createType) as SegmentType) : null}
          config={createConfig}
          onConfigChange={setCreateConfig}
          estimatedCount={createEstimatedCount}
          onEstimate={() => handleEstimate(createType, createConfig, setCreateEstimatedCount, setCreateEstimateLoading)}
          estimateLoading={createEstimateLoading}
        />
      </FormModal>

      {/* Edit Modal */}
      <FormModal
        opened={!!editingSegmentId}
        onClose={closeEdit}
        onSubmit={handleUpdate}
        title={tPage('editTitle')}
        submitLabel={tCommon('actions.save')}
        cancelLabel={tCommon('actions.cancel')}
        closeLabel={tCommon('actions.close')}
        loading={editLoading}
        submitDisabled={!editName.trim() || !editType || editFetchLoading}
      >
        {editFetchLoading ? (
          <Stack align="center" py="xl">
            <Loader size="sm" />
            <Text size="sm" c="dimmed">
              {tPage('loading')}
            </Text>
          </Stack>
        ) : (
          <>
            <TextInput
              label={tCommon('labels.name')}
              placeholder={tPage('namePlaceholder')}
              value={editName}
              onChange={(e) => setEditName(e.currentTarget.value)}
              required
            />
            <TextInput
              label={tCommon('labels.description')}
              placeholder={tCommon('placeholders.optionalDescription')}
              value={editDescription}
              onChange={(e) => setEditDescription(e.currentTarget.value)}
              mt="sm"
            />
            <Select
              label={tCommon('labels.type')}
              placeholder={tPage('typePlaceholder')}
              data={segmentTypeOptions}
              value={editType}
              onChange={handleEditTypeChange}
              required
              mt="sm"
            />
            <SegmentConfigFields
              segmentType={editType ? (Number(editType) as SegmentType) : null}
              config={editConfig}
              onConfigChange={setEditConfig}
              estimatedCount={editEstimatedCount}
              onEstimate={() => handleEstimate(editType, editConfig, setEditEstimatedCount, setEditEstimateLoading)}
              estimateLoading={editEstimateLoading}
            />
          </>
        )}
      </FormModal>

      {/* Archive / restore modal */}
      <ConfirmModal
        opened={!!lifecycleSegment && !!lifecycleAction}
        onClose={closeLifecycle}
        onConfirm={handleLifecycleChange}
        title={tPage(lifecycleAction === 'restore' ? 'restoreTitle' : 'archiveTitle')}
        message={
          <Text>
            {tPage(lifecycleAction === 'restore' ? 'restoreConfirm' : 'archiveConfirm', {
              name: lifecycleSegment?.name ?? '',
              campaigns: lifecycleSegment?.campaign_count ?? 0,
              runs: lifecycleSegment?.delivery_run_count ?? 0,
              files: lifecycleSegment?.download_policy_reference_count ?? 0,
            })}
          </Text>
        }
        confirmLabel={tPage(lifecycleAction === 'restore' ? 'restore' : 'archive')}
        cancelLabel={tCommon('actions.cancel')}
        closeLabel={tCommon('actions.close')}
        confirmTone={lifecycleAction === 'archive' ? 'warning' : 'positive'}
        loading={lifecycleLoading}
      />
    </>
  );
}
