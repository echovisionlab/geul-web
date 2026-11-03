'use client';

import { PageLoader } from '@/features/site/PageLoader';
import { Text as DsText } from '@/components/core/Typography';
import { ConfirmationDialog } from '@/features/confirmation';

import { LayoutInset } from '@/components/core/Layout';

import { notifications } from '@/components/core/Notification';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MemberCriteriaKind } from '@echovisionlab/geul-proto/secure/member_criteria_pb.ts';
import { useTranslations } from 'next-intl';
import { Select, TextInput } from '@/components/core/Input';
import { FormModal } from '@/components/core/Modal';
import {
  createMemberCriteriaAction,
  archiveMemberCriteriaAction,
  countMatchingMembersAction,
  getMemberCriteriaAction,
  restoreMemberCriteriaAction,
  updateMemberCriteriaAction,
} from '@/lib/actions/member-criteria';
import {
  buildCriteriaConfig,
  createEmptyConfig,
  rebasePendingConfig,
  type CriteriaConfigState,
} from './MemberCriteriaConfig';
import { MemberCriteriaConfigFields } from './MemberCriteriaConfigFields';
import { useCriteriaModal } from './MemberCriteriaModalContext';
type CriteriaEditConfig = CriteriaConfigState;
interface CriteriaEditBaseline {
  name: string;
  description: string;
  kind: MemberCriteriaKind;
  config: CriteriaEditConfig;
}
interface CriteriaEditDraft {
  name: string;
  description: string;
  kind: string;
  config: CriteriaEditConfig;
}
function criteriaConfigState(config: {
  memberTagIds: string[];
  accountRoles: string[];
  createdAfter?: string;
  createdBefore?: string;
}): CriteriaEditConfig {
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
function sameCriteriaEditDraft(left: CriteriaEditDraft, right: CriteriaEditDraft): boolean {
  return (
    left.name === right.name &&
    left.description === right.description &&
    left.kind === right.kind &&
    sameStringSet(left.config.memberTagIds, right.config.memberTagIds) &&
    sameStringSet(left.config.accountRoles, right.config.accountRoles) &&
    left.config.createdAfter === right.config.createdAfter &&
    left.config.createdBefore === right.config.createdBefore
  );
}
export interface MemberCriteriaModalsBindings {
  createMemberCriteriaAction: typeof createMemberCriteriaAction;
  archiveMemberCriteriaAction: typeof archiveMemberCriteriaAction;
  countMatchingMembersAction: typeof countMatchingMembersAction;
  getMemberCriteriaAction: typeof getMemberCriteriaAction;
  restoreMemberCriteriaAction: typeof restoreMemberCriteriaAction;
  updateMemberCriteriaAction: typeof updateMemberCriteriaAction;
}
const defaultBindings: MemberCriteriaModalsBindings = {
  createMemberCriteriaAction,
  archiveMemberCriteriaAction,
  countMatchingMembersAction,
  getMemberCriteriaAction,
  restoreMemberCriteriaAction,
  updateMemberCriteriaAction,
};
export function MemberCriteriaModals({
  bindings = defaultBindings,
  refresh,
}: { bindings?: MemberCriteriaModalsBindings; refresh?: () => void } = {}) {
  const tCommon = useTranslations('common');
  const tCommonEntities = useTranslations('common.entities');
  const tPage = useTranslations('adminList.memberCriteria');
  const router = useRouter();
  const {
    lifecycleCriteria,
    lifecycleAction,
    closeLifecycle,
    isCreateOpen,
    closeCreate,
    editingCriteriaId,
    closeEdit,
  } = useCriteriaModal();
  // Create modal state
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createType, setCreateType] = useState<string | null>(null);
  const [createConfig, setCreateConfig] = useState<CriteriaConfigState>(createEmptyConfig());
  const [createLoading, setCreateLoading] = useState(false);
  const [createEstimatedCount, setCreateEstimatedCount] = useState<number | null>(null);
  const [createEstimateLoading, setCreateEstimateLoading] = useState(false);
  // Edit modal state
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editType, setEditType] = useState<string | null>(null);
  const [editConfig, setEditConfig] = useState<CriteriaConfigState>(createEmptyConfig());
  const [editLoading, setEditLoading] = useState(false);
  const [editFetchLoading, setEditFetchLoading] = useState(false);
  const [editEstimatedCount, setEditEstimatedCount] = useState<number | null>(null);
  const [editEstimateLoading, setEditEstimateLoading] = useState(false);
  const [editBaseline, setEditBaseline] = useState<CriteriaEditBaseline | null>(null);
  const [lifecycleLoading, setLifecycleLoading] = useState(false);
  const editingCriteriaIdRef = useRef(editingCriteriaId);
  editingCriteriaIdRef.current = editingCriteriaId;
  const editDraftRef = useRef<CriteriaEditDraft>({
    name: editName,
    description: editDescription,
    kind: editType ?? '',
    config: editConfig,
  });
  editDraftRef.current = {
    name: editName,
    description: editDescription,
    kind: editType ?? '',
    config: editConfig,
  };
  const kindOptions = [
    { value: String(MemberCriteriaKind.ALL_MEMBERS), label: tPage('types.allUsers') },
    { value: String(MemberCriteriaKind.MEMBER_TAGS), label: tCommonEntities('userTags') },
    { value: String(MemberCriteriaKind.FILTER), label: tPage('types.usersByFilter') },
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
  // Load criteria data for edit
  useEffect(() => {
    let isCurrentRequest = true;
    if (!editingCriteriaId) {
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
    bindings
      .getMemberCriteriaAction(editingCriteriaId)
      .then((result) => {
        if (!isCurrentRequest) {
          return;
        }
        if (result.data) {
          const config = criteriaConfigState(result.data.config);
          setEditName(result.data.name);
          setEditDescription(result.data.description);
          setEditType(String(result.data.kind));
          setEditConfig(config);
          setEditBaseline({
            name: result.data.name,
            description: result.data.description,
            kind: result.data.kind,
            config,
          });
          setEditEstimatedCount(result.data.estimatedCount);
        } else {
          setEditBaseline(null);
          notifications.show({ message: result.error ?? tPage('loading'), tone: 'danger' });
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
  }, [editingCriteriaId, closeEdit]);
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
  const estimateIdentity = {
    create: JSON.stringify([isCreateOpen, createType, createConfig]),
    edit: JSON.stringify([editingCriteriaId, editType, editConfig]),
  };
  const estimateIdentityRef = useRef(estimateIdentity);
  estimateIdentityRef.current = estimateIdentity;
  const estimateRequests = useRef({ create: 0, edit: 0 });
  const estimateMounted = useRef(true);
  useEffect(() => {
    estimateMounted.current = true;
    return () => {
      estimateMounted.current = false;
    };
  }, []);
  useEffect(() => {
    setCreateEstimatedCount(null);
    setCreateEstimateLoading(false);
  }, [estimateIdentity.create]);
  useEffect(() => {
    setEditEstimatedCount(null);
    setEditEstimateLoading(false);
  }, [estimateIdentity.edit]);
  const handleEstimate = useCallback(
    async (
      type: string | null,
      config: CriteriaConfigState,
      setCount: (count: number | null) => void,
      setLoading: (loading: boolean) => void,
      scope: 'create' | 'edit',
    ) => {
      if (!type) {
        return;
      }
      const identity = estimateIdentityRef.current[scope];
      const request = ++estimateRequests.current[scope];
      const current = () =>
        estimateMounted.current &&
        estimateIdentityRef.current[scope] === identity &&
        estimateRequests.current[scope] === request;
      setLoading(true);
      try {
        const kind = Number(type) as MemberCriteriaKind;
        const result = await bindings.countMatchingMembersAction({
          kind,
          config: buildCriteriaConfig(kind, config),
        });
        if (!current()) {
          return;
        }
        if (result.error) {
          notifications.show({ message: result.error, tone: 'danger' });
        } else {
          setCount(result.count ?? null);
        }
      } catch {
        if (current()) {
          notifications.show({ message: tCommon('errors.generic'), tone: 'danger' });
        }
      } finally {
        if (current()) {
          setLoading(false);
        }
      }
    },
    [bindings, tCommon],
  );
  const handleCreate = async () => {
    if (!createType) {
      return;
    }
    setCreateLoading(true);
    try {
      const kind = Number(createType) as MemberCriteriaKind;
      const result = await bindings.createMemberCriteriaAction({
        name: createName,
        description: createDescription || undefined,
        kind,
        config: buildCriteriaConfig(kind, createConfig),
      });
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: tPage('created'), tone: 'positive' });
      closeCreate();
      (refresh ?? router.refresh)();
    } finally {
      setCreateLoading(false);
    }
  };
  const handleUpdate = async () => {
    if (!editingCriteriaId || !editType || !editBaseline) {
      return;
    }
    const criteriaId = editingCriteriaId;
    const baseline = editBaseline;
    const submittedDraft: CriteriaEditDraft = {
      name: editName,
      description: editDescription,
      kind: editType,
      config: {
        ...editConfig,
        memberTagIds: [...editConfig.memberTagIds],
        accountRoles: [...editConfig.accountRoles],
      },
    };
    const kind = Number(editType) as MemberCriteriaKind;
    setEditLoading(true);
    try {
      const input: Parameters<typeof bindings.updateMemberCriteriaAction>[0] = {
        id: criteriaId,
        config: buildCriteriaConfig(kind, submittedDraft.config),
        observed: {
          kind: baseline.kind,
          config: buildCriteriaConfig(baseline.kind, baseline.config),
        },
      };
      if (submittedDraft.name !== baseline.name) {
        input.name = submittedDraft.name;
      }
      if (submittedDraft.description !== baseline.description) {
        input.description = submittedDraft.description;
      }
      if (kind !== baseline.kind) {
        input.kind = kind;
      }
      const result = await bindings.updateMemberCriteriaAction(input);
      if (editingCriteriaIdRef.current !== criteriaId) {
        if (result.data) {
          (refresh ?? router.refresh)();
        }
        return;
      }
      if (result.error || !result.data) {
        notifications.show({ message: result.error ?? tPage('loading'), tone: 'danger' });
        return;
      }
      const canonicalConfig = criteriaConfigState(result.data.config);
      const canonicalDraft: CriteriaEditDraft = {
        name: result.data.name,
        description: result.data.description,
        kind: String(result.data.kind),
        config: canonicalConfig,
      };
      const latestDraft = editDraftRef.current;
      const hasPendingTyping = !sameCriteriaEditDraft(latestDraft, submittedDraft);
      const typeChangedWhileSaving = latestDraft.kind !== submittedDraft.kind;
      setEditBaseline({
        name: result.data.name,
        description: result.data.description,
        kind: result.data.kind,
        config: canonicalConfig,
      });
      setEditName(latestDraft.name === submittedDraft.name ? canonicalDraft.name : latestDraft.name);
      setEditDescription(
        latestDraft.description === submittedDraft.description ? canonicalDraft.description : latestDraft.description,
      );
      setEditType(latestDraft.kind === submittedDraft.kind ? canonicalDraft.kind : latestDraft.kind);
      setEditConfig(
        typeChangedWhileSaving
          ? latestDraft.config
          : rebasePendingConfig(canonicalConfig, submittedDraft.config, latestDraft.config),
      );
      notifications.show({ message: tPage('updated'), tone: 'positive' });
      (refresh ?? router.refresh)();
      if (!hasPendingTyping) {
        closeEdit();
      }
    } finally {
      if (editingCriteriaIdRef.current === criteriaId) {
        setEditLoading(false);
      }
    }
  };
  const handleLifecycleChange = async () => {
    if (!lifecycleCriteria || !lifecycleAction) {
      return;
    }
    setLifecycleLoading(true);
    try {
      const result =
        lifecycleAction === 'archive'
          ? await bindings.archiveMemberCriteriaAction(lifecycleCriteria.id)
          : await bindings.restoreMemberCriteriaAction(lifecycleCriteria.id);
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({
        message: tPage(lifecycleAction === 'archive' ? 'archived' : 'restored'),
        tone: 'positive',
      });
      closeLifecycle();
      (refresh ?? router.refresh)();
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
        submitLabel={tCommon('actions.createItem', { item: tCommon('entities.memberCriteria') })}
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
        <LayoutInset space="none" blockStart="sm">
          <TextInput
            label={tCommon('labels.description')}
            placeholder={tCommon('placeholders.optionalDescription')}
            value={createDescription}
            onChange={(e) => setCreateDescription(e.currentTarget.value)}
          />
        </LayoutInset>
        <LayoutInset space="none" blockStart="sm">
          <Select
            label={tCommon('labels.type')}
            placeholder={tPage('typePlaceholder')}
            data={kindOptions}
            value={createType}
            onChange={handleCreateTypeChange}
            required
          />
        </LayoutInset>
        <MemberCriteriaConfigFields
          kind={createType ? (Number(createType) as MemberCriteriaKind) : null}
          config={createConfig}
          onConfigChange={setCreateConfig}
          estimatedCount={createEstimatedCount}
          onEstimate={() =>
            handleEstimate(createType, createConfig, setCreateEstimatedCount, setCreateEstimateLoading, 'create')
          }
          estimateLoading={createEstimateLoading}
        />
      </FormModal>

      {/* Edit Modal */}
      <FormModal
        opened={!!editingCriteriaId}
        onClose={closeEdit}
        onSubmit={handleUpdate}
        title={tPage('editTitle')}
        submitLabel={tCommon('actions.save')}
        submitTone="brand"
        cancelLabel={tCommon('actions.cancel')}
        closeLabel={tCommon('actions.close')}
        loading={editLoading}
        submitDisabled={!editName.trim() || !editType || editFetchLoading}
      >
        {editFetchLoading ? (
          <PageLoader placement="flow" />
        ) : (
          <>
            <TextInput
              label={tCommon('labels.name')}
              placeholder={tPage('namePlaceholder')}
              value={editName}
              onChange={(e) => setEditName(e.currentTarget.value)}
              required
            />
            <LayoutInset space="none" blockStart="sm">
              <TextInput
                label={tCommon('labels.description')}
                placeholder={tCommon('placeholders.optionalDescription')}
                value={editDescription}
                onChange={(e) => setEditDescription(e.currentTarget.value)}
              />
            </LayoutInset>
            <LayoutInset space="none" blockStart="sm">
              <Select
                label={tCommon('labels.type')}
                placeholder={tPage('typePlaceholder')}
                data={kindOptions}
                value={editType}
                onChange={handleEditTypeChange}
                required
              />
            </LayoutInset>
            <MemberCriteriaConfigFields
              kind={editType ? (Number(editType) as MemberCriteriaKind) : null}
              config={editConfig}
              onConfigChange={setEditConfig}
              estimatedCount={editEstimatedCount}
              onEstimate={() =>
                handleEstimate(editType, editConfig, setEditEstimatedCount, setEditEstimateLoading, 'edit')
              }
              estimateLoading={editEstimateLoading}
            />
          </>
        )}
      </FormModal>

      {/* Archive / restore modal */}
      <ConfirmationDialog
        intent={lifecycleAction === 'archive' ? 'archive' : 'restore'}
        opened={!!lifecycleCriteria && !!lifecycleAction}
        onClose={closeLifecycle}
        onConfirm={handleLifecycleChange}
        title={tPage(lifecycleAction === 'restore' ? 'restoreTitle' : 'archiveTitle')}
        message={
          <DsText>
            {tPage(lifecycleAction === 'restore' ? 'restoreConfirm' : 'archiveConfirm', {
              name: lifecycleCriteria?.name ?? '',
              campaigns: lifecycleCriteria?.campaign_count ?? 0,
              runs: lifecycleCriteria?.delivery_run_count ?? 0,
              files: lifecycleCriteria?.download_policy_reference_count ?? 0,
            })}
          </DsText>
        }
        confirmLabel={tPage(lifecycleAction === 'restore' ? 'restore' : 'archive')}
        cancelLabel={tCommon('actions.cancel')}
        closeLabel={tCommon('actions.close')}
        loading={lifecycleLoading}
      />
    </>
  );
}
