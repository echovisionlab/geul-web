'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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

type SegmentEditConfig = SegmentConfigState;

interface SegmentEditBaseline {
  name: string;
  description: string;
  segmentType: SegmentType;
  config: SegmentEditConfig;
}

interface SegmentEditDraft {
  name: string;
  description: string;
  segmentType: string;
  config: SegmentEditConfig;
}

function segmentConfigState(config: {
  memberTagIds: string[];
  accountRoles: string[];
  createdAfter?: string;
  createdBefore?: string;
}): SegmentEditConfig {
  return {
    memberTagIds: config.memberTagIds,
    accountRoles: config.accountRoles,
    createdAfter: config.createdAfter ?? '',
    createdBefore: config.createdBefore ?? '',
  };
}

function sameStringSet(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value) => right.includes(value));
}

function mergePendingStringSet(canonical: string[], submitted: string[], latest: string[]): string[] {
  const merged = new Set(canonical);
  const submittedSet = new Set(submitted);
  const latestSet = new Set(latest);
  for (const value of latest) {
    if (!submittedSet.has(value)) {
      merged.add(value);
    }
  }
  for (const value of submitted) {
    if (!latestSet.has(value)) {
      merged.delete(value);
    }
  }
  return Array.from(merged);
}

function rebasePendingConfig(
  canonical: SegmentEditConfig,
  submitted: SegmentEditConfig,
  latest: SegmentEditConfig,
): SegmentEditConfig {
  return {
    memberTagIds: mergePendingStringSet(canonical.memberTagIds, submitted.memberTagIds, latest.memberTagIds),
    accountRoles: mergePendingStringSet(canonical.accountRoles, submitted.accountRoles, latest.accountRoles),
    createdAfter: latest.createdAfter === submitted.createdAfter ? canonical.createdAfter : latest.createdAfter,
    createdBefore: latest.createdBefore === submitted.createdBefore ? canonical.createdBefore : latest.createdBefore,
  };
}

function sameSegmentEditDraft(left: SegmentEditDraft, right: SegmentEditDraft): boolean {
  return (
    left.name === right.name &&
    left.description === right.description &&
    left.segmentType === right.segmentType &&
    sameStringSet(left.config.memberTagIds, right.config.memberTagIds) &&
    sameStringSet(left.config.accountRoles, right.config.accountRoles) &&
    left.config.createdAfter === right.config.createdAfter &&
    left.config.createdBefore === right.config.createdBefore
  );
}

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
  const [editBaseline, setEditBaseline] = useState<SegmentEditBaseline | null>(null);

  const [lifecycleLoading, setLifecycleLoading] = useState(false);
  const editingSegmentIdRef = useRef(editingSegmentId);
  editingSegmentIdRef.current = editingSegmentId;
  const editDraftRef = useRef<SegmentEditDraft>({
    name: editName,
    description: editDescription,
    segmentType: editType ?? '',
    config: editConfig,
  });
  editDraftRef.current = {
    name: editName,
    description: editDescription,
    segmentType: editType ?? '',
    config: editConfig,
  };
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
    let isCurrentRequest = true;
    if (!editingSegmentId) {
      setEditName('');
      setEditDescription('');
      setEditType(null);
      setEditConfig(createEmptyConfig());
      setEditEstimatedCount(null);
      setEditBaseline(null);
      setEditLoading(false);
      setEditFetchLoading(false);
      return;
    }
    setEditLoading(false);
    setEditFetchLoading(true);
    getSegmentAction(editingSegmentId)
      .then((result) => {
        if (!isCurrentRequest) {
          return;
        }
        if (result.data) {
          const config = segmentConfigState(result.data.config);
          setEditName(result.data.name);
          setEditDescription(result.data.description);
          setEditType(String(result.data.segmentType));
          setEditConfig(config);
          setEditBaseline({
            name: result.data.name,
            description: result.data.description,
            segmentType: result.data.segmentType,
            config,
          });
          setEditEstimatedCount(result.data.estimatedCount);
        } else {
          setEditBaseline(null);
          notifications.show({ message: result.error ?? tPage('loading'), color: 'red' });
          closeEdit();
        }
      })
      .finally(() => {
        if (isCurrentRequest) {
          setEditFetchLoading(false);
        }
      });
    return () => {
      isCurrentRequest = false;
    };
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
    if (!editingSegmentId || !editType || !editBaseline) {
      return;
    }
    const segmentId = editingSegmentId;
    const baseline = editBaseline;
    const submittedDraft: SegmentEditDraft = {
      name: editName,
      description: editDescription,
      segmentType: editType,
      config: {
        ...editConfig,
        memberTagIds: [...editConfig.memberTagIds],
        accountRoles: [...editConfig.accountRoles],
      },
    };
    const segmentType = Number(editType) as SegmentType;
    setEditLoading(true);
    try {
      const input: Parameters<typeof updateSegmentAction>[0] = {
        id: segmentId,
        config: buildSegmentConfig(segmentType, submittedDraft.config),
        observed: {
          segmentType: baseline.segmentType,
          config: buildSegmentConfig(baseline.segmentType, baseline.config),
        },
      };
      if (submittedDraft.name !== baseline.name) {
        input.name = submittedDraft.name;
      }
      if (submittedDraft.description !== baseline.description) {
        input.description = submittedDraft.description;
      }
      if (segmentType !== baseline.segmentType) {
        input.segmentType = segmentType;
      }

      const result = await updateSegmentAction(input);
      if (editingSegmentIdRef.current !== segmentId) {
        if (result.data) {
          router.refresh();
        }
        return;
      }
      if (result.error || !result.data) {
        notifications.show({ message: result.error ?? tPage('loading'), color: 'red' });
        return;
      }

      const canonicalConfig = segmentConfigState(result.data.config);
      const canonicalDraft: SegmentEditDraft = {
        name: result.data.name,
        description: result.data.description,
        segmentType: String(result.data.segmentType),
        config: canonicalConfig,
      };
      const latestDraft = editDraftRef.current;
      const hasPendingTyping = !sameSegmentEditDraft(latestDraft, submittedDraft);
      const typeChangedWhileSaving = latestDraft.segmentType !== submittedDraft.segmentType;
      setEditBaseline({
        name: result.data.name,
        description: result.data.description,
        segmentType: result.data.segmentType,
        config: canonicalConfig,
      });
      setEditName(latestDraft.name === submittedDraft.name ? canonicalDraft.name : latestDraft.name);
      setEditDescription(
        latestDraft.description === submittedDraft.description ? canonicalDraft.description : latestDraft.description,
      );
      setEditType(
        latestDraft.segmentType === submittedDraft.segmentType ? canonicalDraft.segmentType : latestDraft.segmentType,
      );
      setEditConfig(
        typeChangedWhileSaving
          ? latestDraft.config
          : rebasePendingConfig(canonicalConfig, submittedDraft.config, latestDraft.config),
      );
      notifications.show({ message: tPage('updated'), color: 'green' });
      router.refresh();
      if (!hasPendingTyping) {
        closeEdit();
      }
    } finally {
      if (editingSegmentIdRef.current === segmentId) {
        setEditLoading(false);
      }
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
