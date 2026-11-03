'use client';
import { PageLoader } from '@/features/site/PageLoader';

import { Text as DsText } from '@/components/core/Typography';
import { LayoutStack as DsLayoutStack, LayoutInline as DsLayoutInline, LayoutInset } from '@/components/core/Layout';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { IconRestore, IconWand, IconX } from '@tabler/icons-react';
import { SectionCard } from '@/components/core/Section/SectionCard';

import { Spinner as Loader } from '@/components/core/Display';
import { Slider } from '@/components/core/Input';
import { Button } from '@/components/core/Button';
import { IconButton } from '@/components/core/IconButton';
import {
  MESH_OPTIMIZATION_METHOD_DRACO,
  normalizeMeshOptimizationTargetRatioPercent,
  type MeshOptimizationCandidate,
  type MeshOptimizationCandidateResult,
  type MeshOptimizationCandidatesResult,
  type MeshOptimizationClearResult,
} from '@/lib/types/mesh-optimization';

export interface MeshOptimizationRequestContext {
  sourceFileId: string;
  entityId: string;
  entityType: TranscodeEntityType;
  sectionId?: string;
  unitId?: string;
}

export interface MeshOptimizationSelection {
  candidateId?: string;
  fileId?: string;
  targetRatioPercent?: number;
}

export interface ImmersiveSceneMeshOptimizationControls {
  listCandidates: (input: MeshOptimizationRequestContext) => Promise<MeshOptimizationCandidatesResult>;
  generateCandidate: (
    input: MeshOptimizationRequestContext & {
      method: typeof MESH_OPTIMIZATION_METHOD_DRACO;
      targetRatioPercent: number;
    },
  ) => Promise<MeshOptimizationCandidateResult>;
  useCandidate: (
    input: MeshOptimizationRequestContext & { candidateId: string },
  ) => Promise<MeshOptimizationCandidateResult>;
  clearCandidates: (
    input: MeshOptimizationRequestContext & { candidateId?: string },
  ) => Promise<MeshOptimizationClearResult>;
}

interface MeshSourceFile {
  fileId?: string;
  name: string;
  size: string;
  sizeBytes?: number;
}

interface MeshOptimizationPanelProps {
  pageId: string;
  entityType: TranscodeEntityType;
  sectionId: string;
  unitId: string;
  sourceFile: MeshSourceFile;
  selection: MeshOptimizationSelection | null;
  controls?: ImmersiveSceneMeshOptimizationControls;
  disabled?: boolean;
  onUseCandidate: (candidate: MeshOptimizationCandidate) => void;
  onClearSelected: () => void;
  t: (key: MeshOptimizationMessageKey) => string;
}

export type MeshOptimizationMessageKey =
  | 'blockEditor.status.meshOptimizationPending'
  | 'blockEditor.status.meshOptimizationProcessing'
  | 'blockEditor.status.meshOptimizationFailed'
  | 'blockEditor.status.meshOptimizationCancelled'
  | 'blockEditor.status.meshOptimizationQueued'
  | 'blockEditor.status.meshOptimizationGenerated'
  | 'blockEditor.status.meshOptimizationSelected'
  | 'blockEditor.status.meshOptimizationCleared'
  | 'blockEditor.status.meshOptimizationDeleteFailed'
  | 'blockEditor.status.meshOptimizationDeleted'
  | 'blockEditor.labels.optimizedMeshSize'
  | 'blockEditor.labels.meshOptimizationTriangles'
  | 'blockEditor.labels.meshOptimization'
  | 'blockEditor.labels.selectedOptimizedMesh'
  | 'blockEditor.labels.meshOptimizationTargetRatio'
  | 'blockEditor.actions.deleteOptimizedMeshCandidate'
  | 'blockEditor.actions.clearOptimizedMesh'
  | 'blockEditor.actions.generateOptimizedMesh'
  | 'blockEditor.actions.useOptimizedMesh';

type PanelStatus = { tone: 'secondary' | 'danger' | 'positive'; message: string } | null;

function formatByteSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ['KB', 'MB', 'GB'];
  let size = bytes / 1024;
  for (const unit of units) {
    if (size < 1024 || unit === units.at(-1)) {
      return `${size >= 10 ? size.toFixed(0) : size.toFixed(1)} ${unit}`;
    }
    size /= 1024;
  }
  return '';
}

function formatInteger(value: number) {
  return new Intl.NumberFormat('en').format(value);
}

function reductionPercent(sourceSize: number | undefined, optimizedSize: number) {
  if (!sourceSize || sourceSize <= 0 || optimizedSize <= 0) {
    return null;
  }
  return Math.round(((sourceSize - optimizedSize) / sourceSize) * 100);
}

function ratioPercent(originalCount: number | undefined, optimizedCount: number | undefined) {
  if (!originalCount || originalCount <= 0 || !optimizedCount || optimizedCount <= 0) {
    return null;
  }
  return Math.round((optimizedCount / originalCount) * 100);
}

function formatCountWithRatio(optimizedCount: number, originalCount: number | undefined) {
  const ratio = ratioPercent(originalCount, optimizedCount);
  if (ratio === null || !originalCount) {
    return formatInteger(optimizedCount);
  }
  return `${formatInteger(optimizedCount)} (${ratio}%)`;
}

function formatCandidateDescriptor(candidate: MeshOptimizationCandidate) {
  return `${candidate.targetRatioPercent}%`;
}

function candidateMatchesSelection(candidate: MeshOptimizationCandidate, selection: MeshOptimizationSelection | null) {
  if (!selection) {
    return false;
  }
  return (
    (Boolean(selection.candidateId) && candidate.id === selection.candidateId) ||
    (Boolean(selection.fileId) && candidate.fileId === selection.fileId)
  );
}

function statusLabel(candidate: MeshOptimizationCandidate, t: MeshOptimizationPanelProps['t']) {
  if (candidate.status === 'pending') {
    return t('blockEditor.status.meshOptimizationPending');
  }
  if (candidate.status === 'processing') {
    return t('blockEditor.status.meshOptimizationProcessing');
  }
  if (candidate.status === 'failed') {
    return t('blockEditor.status.meshOptimizationFailed');
  }
  if (candidate.status === 'cancelled') {
    return t('blockEditor.status.meshOptimizationCancelled');
  }
  return '';
}

function upsertCandidate(candidates: MeshOptimizationCandidate[], candidate: MeshOptimizationCandidate) {
  const existingIndex = candidates.findIndex((item) => item.id === candidate.id);
  if (existingIndex === -1) {
    return [candidate, ...candidates];
  }
  const next = [...candidates];
  next[existingIndex] = candidate;
  return next;
}

function CandidateStats({
  candidate,
  sourceSizeBytes,
  t,
}: {
  candidate: MeshOptimizationCandidate;
  sourceSizeBytes?: number;
  t: MeshOptimizationPanelProps['t'];
}) {
  if (candidate.status !== 'completed' || candidate.fileSize <= 0) {
    return null;
  }

  const reduction = reductionPercent(candidate.originalFileSize ?? sourceSizeBytes, candidate.fileSize);

  return (
    <DsLayoutInline gap="md" wrap="wrap">
      <DsText size="xs" tone="secondary" nowrap>
        {t('blockEditor.labels.optimizedMeshSize')}{' '}
        <DsText as="span" size="xs" tone="inherit" weight="strong">
          {formatByteSize(candidate.fileSize)}
        </DsText>
        {reduction !== null ? (
          <DsText as="span" size="xs" tone="secondary">
            {' '}
            (-{reduction}%)
          </DsText>
        ) : null}
      </DsText>
      {candidate.triangleCount ? (
        <DsText size="xs" tone="secondary" nowrap>
          {t('blockEditor.labels.meshOptimizationTriangles')}{' '}
          <DsText as="span" size="xs" tone="inherit" weight="strong">
            {formatCountWithRatio(candidate.triangleCount, candidate.originalTriangleCount)}
          </DsText>
        </DsText>
      ) : null}
    </DsLayoutInline>
  );
}

export function MeshOptimizationPanel(props: MeshOptimizationPanelProps) {
  return (
    <MeshOptimizationPanelSession
      key={`${props.entityType}:${props.pageId}:${props.sectionId}:${props.unitId}:${props.sourceFile.fileId}`}
      {...props}
    />
  );
}

function MeshOptimizationPanelSession({
  pageId,
  entityType,
  sectionId,
  unitId,
  sourceFile,
  selection,
  controls,
  disabled = false,
  onUseCandidate,
  onClearSelected,
  t,
}: MeshOptimizationPanelProps) {
  const [targetRatioPercent, setTargetRatioPercent] = useState(() =>
    normalizeMeshOptimizationTargetRatioPercent(selection?.targetRatioPercent ?? 70),
  );
  const [candidates, setCandidates] = useState<MeshOptimizationCandidate[]>([]);
  const [status, setStatus] = useState<PanelStatus>(null);
  const [loading, setLoading] = useState(Boolean(controls && sourceFile.fileId));
  const active = useRef(true);
  const readVersion = useRef(0);
  const readPending = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      readVersion.current += 1;
    };
  }, []);
  const [generating, setGenerating] = useState(false);
  const [usingCandidateId, setUsingCandidateId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [deletingCandidateId, setDeletingCandidateId] = useState<string | null>(null);
  const discardedCandidateIdsRef = useRef(new Set<string>());

  const requestContext = useMemo<MeshOptimizationRequestContext | null>(() => {
    if (!sourceFile.fileId) {
      return null;
    }
    return {
      sourceFileId: sourceFile.fileId,
      entityId: pageId,
      entityType,
      sectionId,
      unitId,
    };
  }, [entityType, pageId, sectionId, sourceFile.fileId, unitId]);

  useEffect(() => {
    discardedCandidateIdsRef.current.clear();
  }, [sourceFile.fileId, unitId]);

  const loadCandidates = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!controls || !requestContext) {
        setCandidates([]);
        return;
      }
      if (silent && readPending.current) {
        return;
      }
      const version = ++readVersion.current;
      readPending.current = true;
      if (!silent) {
        setLoading(true);
      }
      try {
        const result = await controls.listCandidates(requestContext);
        if (!active.current || version !== readVersion.current) {
          return;
        }
        setCandidates(
          result.candidates.filter(
            (candidate) => candidate.status !== 'cancelled' && !discardedCandidateIdsRef.current.has(candidate.id),
          ),
        );
        if (result.error) {
          setStatus({ tone: 'danger', message: result.error });
        }
      } catch {
        if (active.current && version === readVersion.current) {
          setStatus({ tone: 'danger', message: t('blockEditor.status.meshOptimizationFailed') });
        }
      } finally {
        if (active.current && version === readVersion.current) {
          readPending.current = false;
          setLoading(false);
        }
      }
    },
    [controls, requestContext, t],
  );

  useEffect(() => {
    void loadCandidates();
    return () => {
      readVersion.current += 1;
      readPending.current = false;
    };
  }, [loadCandidates]);

  const hasRunningCandidate = candidates.some(
    (candidate) => candidate.status === 'pending' || candidate.status === 'processing',
  );
  useEffect(() => {
    if (!hasRunningCandidate) {
      return undefined;
    }
    const interval = window.setInterval(() => {
      void loadCandidates({ silent: true });
    }, 2000);
    return () => window.clearInterval(interval);
  }, [hasRunningCandidate, loadCandidates]);

  const completedCandidates = candidates.filter((candidate) => candidate.status === 'completed');
  const runningCandidates = candidates.filter(
    (candidate) => candidate.status === 'pending' || candidate.status === 'processing',
  );
  const failedCandidates = candidates.filter(
    (candidate) => candidate.status === 'failed' || candidate.status === 'cancelled',
  );
  const selectedCandidate = useMemo(
    () => candidates.find((candidate) => candidateMatchesSelection(candidate, selection)) ?? null,
    [candidates, selection],
  );
  const selectedTargetRatioPercent = selection?.targetRatioPercent ?? selectedCandidate?.targetRatioPercent;
  const selectableCompletedCandidates = completedCandidates.filter(
    (candidate) => !candidateMatchesSelection(candidate, selection),
  );

  useEffect(() => {
    setTargetRatioPercent(normalizeMeshOptimizationTargetRatioPercent(selectedTargetRatioPercent ?? 70));
  }, [selectedTargetRatioPercent, selection?.candidateId, selection?.fileId, sourceFile.fileId, unitId]);

  const generateCandidate = useCallback(async () => {
    if (!controls || !requestContext) {
      return;
    }
    setGenerating(true);
    setStatus(null);
    try {
      const result = await controls.generateCandidate({
        ...requestContext,
        method: MESH_OPTIMIZATION_METHOD_DRACO,
        targetRatioPercent: normalizeMeshOptimizationTargetRatioPercent(targetRatioPercent),
      });
      if (!active.current) {
        return;
      }
      readVersion.current += 1;
      readPending.current = false;
      if (result.error) {
        setStatus({ tone: 'danger', message: result.error });
        return;
      }
      const candidate = result.candidate;
      if (candidate) {
        discardedCandidateIdsRef.current.delete(candidate.id);
        setCandidates((current) => upsertCandidate(current, candidate));
        if (candidate.status !== 'completed') {
          setStatus({
            tone: 'secondary',
            message: t('blockEditor.status.meshOptimizationQueued'),
          });
          return;
        }
        setStatus({
          tone: 'positive',
          message: t('blockEditor.status.meshOptimizationGenerated'),
        });
      }
    } finally {
      if (active.current) {
        setGenerating(false);
      }
    }
  }, [controls, targetRatioPercent, requestContext, t]);

  const useCandidate = useCallback(
    async (candidate: MeshOptimizationCandidate) => {
      if (!controls || !requestContext) {
        return;
      }
      setUsingCandidateId(candidate.id);
      setStatus(null);
      try {
        const result = await controls.useCandidate({
          ...requestContext,
          candidateId: candidate.id,
        });
        if (!active.current) {
          return;
        }
        readVersion.current += 1;
        readPending.current = false;
        if (result.error) {
          setStatus({ tone: 'danger', message: result.error });
          return;
        }
        onUseCandidate(result.candidate ?? candidate);
        setStatus({
          tone: 'positive',
          message: t('blockEditor.status.meshOptimizationSelected'),
        });
      } finally {
        if (active.current) {
          setUsingCandidateId(null);
        }
      }
    },
    [controls, onUseCandidate, requestContext, t],
  );

  const clearSelected = useCallback(async () => {
    if (!selection) {
      return;
    }
    setClearing(true);
    setStatus(null);
    try {
      onClearSelected();
      setStatus({
        tone: 'positive',
        message: t('blockEditor.status.meshOptimizationCleared'),
      });
    } finally {
      setClearing(false);
    }
  }, [onClearSelected, selection, t]);

  const deleteCandidate = useCallback(
    async (candidate: MeshOptimizationCandidate) => {
      if (!controls || !requestContext) {
        return;
      }
      const wasSelected = candidateMatchesSelection(candidate, selection);
      setDeletingCandidateId(candidate.id);
      setStatus(null);
      try {
        const result = await controls.clearCandidates({
          ...requestContext,
          candidateId: candidate.id,
        });
        if (!active.current) {
          return;
        }
        readVersion.current += 1;
        readPending.current = false;
        if (result.error || !result.success) {
          setStatus({
            tone: 'danger',
            message: result.error || t('blockEditor.status.meshOptimizationDeleteFailed'),
          });
          return;
        }
        discardedCandidateIdsRef.current.add(candidate.id);
        setCandidates((current) => current.filter((item) => item.id !== candidate.id));
        if (wasSelected) {
          onClearSelected();
        }
        setStatus({
          tone: 'positive',
          message: t('blockEditor.status.meshOptimizationDeleted'),
        });
      } finally {
        if (active.current) {
          setDeletingCandidateId(null);
        }
      }
    },
    [controls, onClearSelected, requestContext, selection, t],
  );

  const candidateActionsDisabled =
    disabled ||
    loading ||
    !controls ||
    !requestContext ||
    deletingCandidateId !== null ||
    usingCandidateId !== null ||
    clearing ||
    generating;
  const candidateDeleteLabel = (candidate: MeshOptimizationCandidate) =>
    `${t('blockEditor.actions.deleteOptimizedMeshCandidate')} (${formatCandidateDescriptor(candidate)})`;

  return (
    <DsLayoutStack gap="xs" data-testid={`immersive-scene-mesh-optimization-${unitId}`}>
      <DsLayoutInline justify="between" gap="xs" align="start">
        <DsText size="xs" weight="medium">
          {t('blockEditor.labels.meshOptimization')}
        </DsText>
        {loading ? <PageLoader placement="flow" minHeight={80} size="xs" /> : null}
      </DsLayoutInline>

      {selection ? (
        <SectionCard
          padding="none"
          appearance="plain"
          border="block"
          role="group"
          aria-label={t('blockEditor.labels.selectedOptimizedMesh')}
          data-testid={`immersive-scene-selected-mesh-optimization-${unitId}`}
        >
          <LayoutInset block="xs">
            <DsLayoutInline justify="between" gap="xs" align="start" wrap="nowrap">
              <DsLayoutStack gap="xxs" flexible>
                <DsLayoutInline gap="xxs" wrap="nowrap">
                  <DsText size="xs" weight="medium">
                    {t('blockEditor.labels.selectedOptimizedMesh')}
                  </DsText>
                  {selectedTargetRatioPercent ? (
                    <DsText size="xs" tone="secondary">
                      {selectedTargetRatioPercent}%
                    </DsText>
                  ) : null}
                </DsLayoutInline>
                <DsText size="xs" tone="secondary" lines={1}>
                  <strong>{selectedCandidate?.fileName || selection.fileId || selection.candidateId}</strong>
                </DsText>
                {selectedCandidate ? (
                  <CandidateStats candidate={selectedCandidate} sourceSizeBytes={sourceFile.sizeBytes} t={t} />
                ) : null}
              </DsLayoutStack>
              <DsLayoutInline gap="xxs" wrap="nowrap">
                <IconButton
                  size="xs"
                  emphasis="low"
                  disabled={candidateActionsDisabled || clearing}
                  loading={clearing}
                  title={t('blockEditor.actions.clearOptimizedMesh')}
                  aria-label={t('blockEditor.actions.clearOptimizedMesh')}
                  onClick={() => void clearSelected()}
                >
                  <IconRestore size={14} />
                </IconButton>
                {selectedCandidate ? (
                  <IconButton
                    size="xs"
                    tone="danger"
                    emphasis="low"
                    disabled={candidateActionsDisabled}
                    loading={deletingCandidateId === selectedCandidate.id}
                    title={candidateDeleteLabel(selectedCandidate)}
                    aria-label={candidateDeleteLabel(selectedCandidate)}
                    onClick={() => void deleteCandidate(selectedCandidate)}
                  >
                    <IconX size={14} />
                  </IconButton>
                ) : null}
              </DsLayoutInline>
            </DsLayoutInline>
          </LayoutInset>
        </SectionCard>
      ) : null}

      <DsLayoutStack gap="xxs">
        <DsLayoutInline justify="between" gap="xs">
          <DsText size="xs" weight="medium">
            {t('blockEditor.labels.meshOptimizationTargetRatio')}
          </DsText>
          <DsText size="xs" tone="secondary">
            {targetRatioPercent}%
          </DsText>
        </DsLayoutInline>
        <Slider
          thumbLabel={t('blockEditor.labels.meshOptimizationTargetRatio')}
          data-testid={`immersive-scene-mesh-optimization-target-ratio-${unitId}`}
          min={1}
          max={100}
          step={1}
          value={targetRatioPercent}
          disabled={candidateActionsDisabled}
          onChange={(value) => setTargetRatioPercent(normalizeMeshOptimizationTargetRatioPercent(value))}
        />
        <Button
          size="xs"
          emphasis="medium"
          leftSection={<IconWand size={14} />}
          disabled={candidateActionsDisabled}
          loading={generating}
          onClick={() => void generateCandidate()}
        >
          {t('blockEditor.actions.generateOptimizedMesh')}
        </Button>
      </DsLayoutStack>

      {runningCandidates.length > 0 ? (
        <DsLayoutStack gap="xxs">
          {runningCandidates.map((candidate) => (
            <SectionCard
              key={candidate.id}
              padding="none"
              appearance="plain"
              border="block-start"
              role="group"
              aria-label={formatCandidateDescriptor(candidate)}
              data-testid={`immersive-scene-mesh-optimization-candidate-${candidate.id}`}
            >
              <LayoutInset blockStart="xs">
                <DsLayoutInline justify="between" gap="xs" align="start" wrap="nowrap">
                  <DsLayoutStack gap="xxs" flexible>
                    <DsText size="xs" weight="medium">
                      {formatCandidateDescriptor(candidate)}
                    </DsText>
                    <DsText size="xs" tone="secondary">
                      {statusLabel(candidate, t)}
                    </DsText>
                  </DsLayoutStack>
                  <DsLayoutInline gap="xxs" wrap="nowrap">
                    <Loader size="xs" />
                    <IconButton
                      size="xs"
                      tone="danger"
                      emphasis="low"
                      disabled={candidateActionsDisabled}
                      loading={deletingCandidateId === candidate.id}
                      title={candidateDeleteLabel(candidate)}
                      aria-label={candidateDeleteLabel(candidate)}
                      onClick={() => void deleteCandidate(candidate)}
                    >
                      <IconX size={14} />
                    </IconButton>
                  </DsLayoutInline>
                </DsLayoutInline>
              </LayoutInset>
            </SectionCard>
          ))}
        </DsLayoutStack>
      ) : null}

      {selectableCompletedCandidates.length > 0 ? (
        <DsLayoutStack gap="xxs">
          {selectableCompletedCandidates.map((candidate) => (
            <SectionCard
              key={candidate.id}
              padding="none"
              appearance="plain"
              border="block-start"
              role="group"
              aria-label={formatCandidateDescriptor(candidate)}
              data-testid={`immersive-scene-mesh-optimization-candidate-${candidate.id}`}
            >
              <LayoutInset blockStart="xs">
                <DsLayoutInline justify="between" gap="xs" align="start" wrap="nowrap">
                  <DsLayoutStack gap="xxs" flexible>
                    <DsText size="xs" weight="medium">
                      {formatCandidateDescriptor(candidate)}
                    </DsText>
                    <DsText size="xs" tone="secondary" lines={1}>
                      {candidate.fileName}
                    </DsText>
                    <CandidateStats candidate={candidate} sourceSizeBytes={sourceFile.sizeBytes} t={t} />
                  </DsLayoutStack>
                  <DsLayoutInline gap="xxs" wrap="nowrap">
                    <Button
                      size="xs"
                      emphasis="low"
                      disabled={candidateActionsDisabled}
                      loading={usingCandidateId === candidate.id}
                      onClick={() => void useCandidate(candidate)}
                    >
                      {t('blockEditor.actions.useOptimizedMesh')}
                    </Button>
                    <IconButton
                      size="xs"
                      tone="danger"
                      emphasis="low"
                      disabled={candidateActionsDisabled}
                      loading={deletingCandidateId === candidate.id}
                      title={candidateDeleteLabel(candidate)}
                      aria-label={candidateDeleteLabel(candidate)}
                      onClick={() => void deleteCandidate(candidate)}
                    >
                      <IconX size={14} />
                    </IconButton>
                  </DsLayoutInline>
                </DsLayoutInline>
              </LayoutInset>
            </SectionCard>
          ))}
        </DsLayoutStack>
      ) : null}

      {failedCandidates.length > 0 ? (
        <DsLayoutStack gap="xxs">
          {failedCandidates.map((candidate) => (
            <SectionCard
              key={candidate.id}
              padding="none"
              appearance="plain"
              border="block-start"
              role="group"
              aria-label={formatCandidateDescriptor(candidate)}
              data-testid={`immersive-scene-mesh-optimization-candidate-${candidate.id}`}
            >
              <LayoutInset blockStart="xs">
                <DsLayoutInline justify="between" gap="xs" align="start" wrap="nowrap">
                  <DsLayoutStack gap="xxs" flexible>
                    <DsLayoutInline gap="xxs" wrap="wrap">
                      <DsText size="xs" weight="medium" tone="danger">
                        {formatCandidateDescriptor(candidate)}
                      </DsText>
                      <DsText size="xs" tone="danger">
                        {statusLabel(candidate, t)}
                      </DsText>
                    </DsLayoutInline>
                    {candidate.errorMessage ? (
                      <DsText size="xs" tone="secondary">
                        {candidate.errorMessage}
                      </DsText>
                    ) : null}
                  </DsLayoutStack>
                  <IconButton
                    size="xs"
                    tone="danger"
                    emphasis="low"
                    disabled={candidateActionsDisabled}
                    loading={deletingCandidateId === candidate.id}
                    title={candidateDeleteLabel(candidate)}
                    aria-label={candidateDeleteLabel(candidate)}
                    onClick={() => void deleteCandidate(candidate)}
                  >
                    <IconX size={14} />
                  </IconButton>
                </DsLayoutInline>
              </LayoutInset>
            </SectionCard>
          ))}
        </DsLayoutStack>
      ) : null}

      {status ? (
        <DsText size="xs" tone={status.tone}>
          {status.message}
        </DsText>
      ) : null}
    </DsLayoutStack>
  );
}
