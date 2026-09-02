'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { IconRestore, IconWand, IconX } from '@tabler/icons-react';
import { Box, Group, Loader, Stack, Text } from '@mantine/core';
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

type PanelStatus = { tone: 'dimmed' | 'red' | 'green'; message: string } | null;

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
    <Group
      gap={16}
      wrap="wrap"
      style={{
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
        {t('blockEditor.labels.optimizedMeshSize')}{' '}
        <Text component="span" size="xs" c="inherit" fw={600}>
          {formatByteSize(candidate.fileSize)}
        </Text>
        {reduction !== null ? (
          <Text component="span" size="xs" c="dimmed">
            {' '}
            (-{reduction}%)
          </Text>
        ) : null}
      </Text>
      {candidate.triangleCount ? (
        <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
          {t('blockEditor.labels.meshOptimizationTriangles')}{' '}
          <Text component="span" size="xs" c="inherit" fw={600}>
            {formatCountWithRatio(candidate.triangleCount, candidate.originalTriangleCount)}
          </Text>
        </Text>
      ) : null}
    </Group>
  );
}

export function MeshOptimizationPanel({
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
  const [loading, setLoading] = useState(false);
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
      if (!silent) {
        setLoading(true);
      }
      try {
        const result = await controls.listCandidates(requestContext);
        setCandidates(
          result.candidates.filter(
            (candidate) => candidate.status !== 'cancelled' && !discardedCandidateIdsRef.current.has(candidate.id),
          ),
        );
        if (result.error) {
          setStatus({ tone: 'red', message: result.error });
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [controls, requestContext],
  );

  useEffect(() => {
    void loadCandidates();
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
      if (result.error) {
        setStatus({ tone: 'red', message: result.error });
        return;
      }
      const candidate = result.candidate;
      if (candidate) {
        discardedCandidateIdsRef.current.delete(candidate.id);
        setCandidates((current) => upsertCandidate(current, candidate));
        if (candidate.status !== 'completed') {
          setStatus({
            tone: 'dimmed',
            message: t('blockEditor.status.meshOptimizationQueued'),
          });
          return;
        }
        setStatus({
          tone: 'green',
          message: t('blockEditor.status.meshOptimizationGenerated'),
        });
      }
    } finally {
      setGenerating(false);
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
        if (result.error) {
          setStatus({ tone: 'red', message: result.error });
          return;
        }
        onUseCandidate(result.candidate ?? candidate);
        setStatus({
          tone: 'green',
          message: t('blockEditor.status.meshOptimizationSelected'),
        });
      } finally {
        setUsingCandidateId(null);
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
        tone: 'green',
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
        if (result.error || !result.success) {
          setStatus({
            tone: 'red',
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
          tone: 'green',
          message: t('blockEditor.status.meshOptimizationDeleted'),
        });
      } finally {
        setDeletingCandidateId(null);
      }
    },
    [controls, onClearSelected, requestContext, selection, t],
  );

  const candidateActionsDisabled =
    disabled ||
    !controls ||
    !requestContext ||
    deletingCandidateId !== null ||
    usingCandidateId !== null ||
    clearing ||
    generating;
  const candidateDeleteLabel = (candidate: MeshOptimizationCandidate) =>
    `${t('blockEditor.actions.deleteOptimizedMeshCandidate')} (${formatCandidateDescriptor(candidate)})`;

  return (
    <Stack gap={8} data-testid={`immersive-scene-mesh-optimization-${unitId}`}>
      <Group justify="space-between" gap="xs" align="flex-start">
        <Text size="xs" fw={500}>
          {t('blockEditor.labels.meshOptimization')}
        </Text>
        {loading ? <Loader size="xs" /> : null}
      </Group>

      {selection ? (
        <Box
          py={8}
          style={{
            borderTop: '1px solid var(--mantine-color-default-border)',
            borderBottom: '1px solid var(--mantine-color-default-border)',
          }}
          data-testid={`immersive-scene-selected-mesh-optimization-${unitId}`}
        >
          <Group justify="space-between" gap="xs" align="flex-start" wrap="nowrap">
            <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
              <Group gap={6} wrap="nowrap">
                <Text size="xs" fw={500}>
                  {t('blockEditor.labels.selectedOptimizedMesh')}
                </Text>
                {selectedTargetRatioPercent ? (
                  <Text size="xs" c="dimmed">
                    {selectedTargetRatioPercent}%
                  </Text>
                ) : null}
              </Group>
              <Text size="xs" c="dimmed" lineClamp={1}>
                <strong>{selectedCandidate?.fileName || selection.fileId || selection.candidateId}</strong>
              </Text>
              {selectedCandidate ? (
                <CandidateStats candidate={selectedCandidate} sourceSizeBytes={sourceFile.sizeBytes} t={t} />
              ) : null}
            </Stack>
            <Group gap={2} wrap="nowrap">
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
            </Group>
          </Group>
        </Box>
      ) : null}

      <Stack gap={6}>
        <Group justify="space-between" gap="xs">
          <Text size="xs" fw={500}>
            {t('blockEditor.labels.meshOptimizationTargetRatio')}
          </Text>
          <Text size="xs" c="dimmed">
            {targetRatioPercent}%
          </Text>
        </Group>
        <Slider
          thumbLabel={t('blockEditor.labels.meshOptimizationTargetRatio')}
          data-testid={`immersive-scene-mesh-optimization-target-ratio-${unitId}`}
          min={1}
          max={100}
          step={1}
          value={targetRatioPercent}
          disabled={candidateActionsDisabled}
          onChange={(value) => setTargetRatioPercent(normalizeMeshOptimizationTargetRatioPercent(value))}
          size="xs"
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
      </Stack>

      {runningCandidates.length > 0 ? (
        <Stack gap={6}>
          {runningCandidates.map((candidate) => (
            <Box
              key={candidate.id}
              pt={8}
              style={{
                borderTop: '1px solid var(--mantine-color-default-border)',
              }}
              data-testid={`immersive-scene-mesh-optimization-candidate-${candidate.id}`}
            >
              <Group justify="space-between" gap="xs" align="flex-start" wrap="nowrap">
                <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
                  <Text size="xs" fw={500}>
                    {formatCandidateDescriptor(candidate)}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {statusLabel(candidate, t)}
                  </Text>
                </Stack>
                <Group gap={2} wrap="nowrap">
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
                </Group>
              </Group>
            </Box>
          ))}
        </Stack>
      ) : null}

      {selectableCompletedCandidates.length > 0 ? (
        <Stack gap={6}>
          {selectableCompletedCandidates.map((candidate) => (
            <Box
              key={candidate.id}
              pt={8}
              style={{
                borderTop: '1px solid var(--mantine-color-default-border)',
              }}
              data-testid={`immersive-scene-mesh-optimization-candidate-${candidate.id}`}
            >
              <Group justify="space-between" gap="xs" align="flex-start" wrap="nowrap">
                <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
                  <Text size="xs" fw={500}>
                    {formatCandidateDescriptor(candidate)}
                  </Text>
                  <Text size="xs" c="dimmed" lineClamp={1}>
                    {candidate.fileName}
                  </Text>
                  <CandidateStats candidate={candidate} sourceSizeBytes={sourceFile.sizeBytes} t={t} />
                </Stack>
                <Group gap={2} wrap="nowrap">
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
                </Group>
              </Group>
            </Box>
          ))}
        </Stack>
      ) : null}

      {failedCandidates.length > 0 ? (
        <Stack gap={6}>
          {failedCandidates.map((candidate) => (
            <Box
              key={candidate.id}
              pt={8}
              style={{
                borderTop: '1px solid var(--mantine-color-default-border)',
              }}
              data-testid={`immersive-scene-mesh-optimization-candidate-${candidate.id}`}
            >
              <Group justify="space-between" gap="xs" align="flex-start" wrap="nowrap">
                <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
                  <Group gap={6} wrap="wrap">
                    <Text size="xs" fw={500} c="red">
                      {formatCandidateDescriptor(candidate)}
                    </Text>
                    <Text size="xs" c="red">
                      {statusLabel(candidate, t)}
                    </Text>
                  </Group>
                  {candidate.errorMessage ? (
                    <Text size="xs" c="dimmed">
                      {candidate.errorMessage}
                    </Text>
                  ) : null}
                </Stack>
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
              </Group>
            </Box>
          ))}
        </Stack>
      ) : null}

      {status ? (
        <Text size="xs" c={status.tone}>
          {status.message}
        </Text>
      ) : null}
    </Stack>
  );
}
