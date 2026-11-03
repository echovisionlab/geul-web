// @vitest-environment jsdom

import { render, screen, userEvent, act, waitFor, fireEvent } from '@/test/render';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { MESH_OPTIMIZATION_METHOD_DRACO } from '@/lib/types/mesh-optimization';
import {
  MeshOptimizationPanel,
  type ImmersiveSceneMeshOptimizationControls,
  type MeshOptimizationMessageKey,
  type MeshOptimizationSelection,
} from './MeshOptimizationPanel';

const meshOptimizationMessages: Record<MeshOptimizationMessageKey, string> = {
  'blockEditor.status.meshOptimizationPending': 'Queued',
  'blockEditor.status.meshOptimizationProcessing': 'Processing',
  'blockEditor.status.meshOptimizationFailed': 'Failed',
  'blockEditor.status.meshOptimizationCancelled': 'Cancelled',
  'blockEditor.status.meshOptimizationQueued': 'Queued',
  'blockEditor.status.meshOptimizationGenerated': 'Compressed GLB generated.',
  'blockEditor.status.meshOptimizationSelected': 'Compressed GLB selected.',
  'blockEditor.status.meshOptimizationCleared': 'Original GLB restored.',
  'blockEditor.status.meshOptimizationDeleteFailed': 'Failed to delete compressed GLB.',
  'blockEditor.status.meshOptimizationDeleted': 'Compressed GLB deleted.',
  'blockEditor.labels.optimizedMeshSize': 'Compressed size',
  'blockEditor.labels.meshOptimizationTriangles': 'Triangles',
  'blockEditor.labels.meshOptimization': 'GLB optimization',
  'blockEditor.labels.selectedOptimizedMesh': 'Selected compressed GLB',
  'blockEditor.labels.meshOptimizationTargetRatio': 'Target mesh ratio',
  'blockEditor.actions.deleteOptimizedMeshCandidate': 'Delete compressed GLB',
  'blockEditor.actions.clearOptimizedMesh': 'Use original GLB',
  'blockEditor.actions.generateOptimizedMesh': 'Compress GLB',
  'blockEditor.actions.useOptimizedMesh': 'Use compressed GLB',
};

function translateMeshOptimization(key: MeshOptimizationMessageKey) {
  return meshOptimizationMessages[key];
}

async function flushEffects() {
  await waitFor(() => expect(screen.queryByRole('status', { name: 'Loading...' })).not.toBeInTheDocument());
}
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('MeshOptimizationPanel', () => {
  it('renders failed candidates by status and error instead of output filename', async () => {
    const controls: ImmersiveSceneMeshOptimizationControls = {
      listCandidates: vi.fn().mockResolvedValue({
        candidates: [
          {
            id: 'failed-candidate',
            sourceFileId: 'source-mesh',
            fileId: '',
            url: '',
            fileName: '5c285545-9c7d-442b-b8c7-3bbae5373765.glb',
            fileSize: 0,
            method: MESH_OPTIMIZATION_METHOD_DRACO,
            targetRatioPercent: 40,
            status: 'failed',
            errorMessage: 'mesh optimization publisher is not configured',
          },
        ],
      }),
      generateCandidate: vi.fn(),
      useCandidate: vi.fn(),
      clearCandidates: vi.fn(),
    };

    render(
      <MeshOptimizationPanel
        pageId="page-1"
        entityType={TranscodeEntityType.PAGE}
        sectionId="section-1"
        unitId="unit-1"
        sourceFile={{ fileId: 'source-mesh', name: 'source.glb', size: '8 MB' }}
        selection={null}
        controls={controls}
        onUseCandidate={vi.fn()}
        onClearSelected={vi.fn()}
        t={translateMeshOptimization}
      />,
    );
    await flushEffects();

    const candidate = screen.queryByRole('group', { name: '40%' });
    expect(candidate?.textContent).toContain('40%');
    expect(candidate?.textContent).toContain('Failed');
    expect(candidate?.textContent).toContain('mesh optimization publisher is not configured');
    expect(candidate?.textContent).not.toContain('5c285545-9c7d-442b-b8c7-3bbae5373765.glb');
    expect(screen.getByRole('button', { name: 'Delete compressed GLB (40%)' })).not.toBeNull();
  });

  it('separates file reduction from actual mesh ratios', async () => {
    const controls: ImmersiveSceneMeshOptimizationControls = {
      listCandidates: vi.fn().mockResolvedValue({
        candidates: [
          {
            id: 'completed-candidate',
            sourceFileId: 'source-mesh',
            fileId: 'compressed-mesh',
            url: '/media/mesh/compressed-mesh.glb',
            fileName: 'compressed-mesh.glb',
            fileSize: 1024,
            originalFileSize: 4096,
            method: MESH_OPTIMIZATION_METHOD_DRACO,
            targetRatioPercent: 1,
            status: 'completed',
            triangleCount: 150,
            vertexCount: 250,
            originalTriangleCount: 1000,
            originalVertexCount: 1000,
          },
        ],
      }),
      generateCandidate: vi.fn(),
      useCandidate: vi.fn(),
      clearCandidates: vi.fn(),
    };

    render(
      <MeshOptimizationPanel
        pageId="page-1"
        entityType={TranscodeEntityType.PAGE}
        sectionId="section-1"
        unitId="unit-1"
        sourceFile={{
          fileId: 'source-mesh',
          name: 'source.glb',
          size: '4 KB',
          sizeBytes: 4096,
        }}
        selection={null}
        controls={controls}
        onUseCandidate={vi.fn()}
        onClearSelected={vi.fn()}
        t={translateMeshOptimization}
      />,
    );
    await flushEffects();

    const candidate = screen.queryByRole('group', { name: '1%' });
    expect(candidate?.textContent).toContain('Compressed size 1.0 KB (-75%)');
    expect(candidate?.textContent).toContain('Triangles 150 (15%)');
    expect(candidate?.textContent).not.toContain('Vertices');
    expect(candidate?.textContent).not.toContain('Method');
  });

  it('generates a DRACO candidate with the selected target ratio and unit context', async () => {
    const pendingCandidate = {
      id: 'source-mesh-draco-60',
      sourceFileId: 'source-mesh',
      fileId: '',
      url: '',
      fileName: '',
      fileSize: 0,
      method: MESH_OPTIMIZATION_METHOD_DRACO,
      targetRatioPercent: 60,
      status: 'pending' as const,
    };
    const generateCandidate = vi.fn().mockResolvedValue({ candidate: pendingCandidate });
    const controls: ImmersiveSceneMeshOptimizationControls = {
      listCandidates: vi.fn().mockResolvedValue({ candidates: [] }),
      generateCandidate,
      useCandidate: vi.fn(),
      clearCandidates: vi.fn(),
    };

    render(
      <MeshOptimizationPanel
        pageId="page-1"
        entityType={TranscodeEntityType.PAGE}
        sectionId="section-1"
        unitId="unit-1"
        sourceFile={{ fileId: 'source-mesh', name: 'source.glb', size: '8 MB' }}
        selection={null}
        controls={controls}
        onUseCandidate={vi.fn()}
        onClearSelected={vi.fn()}
        t={translateMeshOptimization}
      />,
    );
    await flushEffects();

    const slider = screen.getByRole('slider', { name: 'Target mesh ratio' });
    expect(slider).toHaveValue('70');
    slider.focus();
    await userEvent.keyboard('{ArrowLeft>10/}');
    expect(slider).toHaveValue('60');

    await userEvent.click(screen.getByRole('button', { name: 'Compress GLB' }));

    expect(generateCandidate).toHaveBeenCalledWith({
      sourceFileId: 'source-mesh',
      entityId: 'page-1',
      entityType: TranscodeEntityType.PAGE,
      sectionId: 'section-1',
      unitId: 'unit-1',
      method: MESH_OPTIMIZATION_METHOD_DRACO,
      targetRatioPercent: 60,
    });
    expect(screen.getByRole('group', { name: '60%' })).not.toBeNull();
  });

  it('restores the selected candidate and compression target from durable IDs', async () => {
    const selectedCandidate = {
      id: 'selected-candidate',
      sourceFileId: 'source-mesh',
      fileId: 'compressed-mesh',
      url: '/media/mesh/compressed-mesh.glb',
      fileName: 'compressed-mesh.glb',
      fileSize: 688 * 1024,
      originalFileSize: 22 * 1024 * 1024,
      method: MESH_OPTIMIZATION_METHOD_DRACO,
      targetRatioPercent: 1,
      status: 'completed' as const,
      triangleCount: 42_577,
      vertexCount: 72_746,
      originalTriangleCount: 277_659,
      originalVertexCount: 285_901,
    };
    const controls: ImmersiveSceneMeshOptimizationControls = {
      listCandidates: vi.fn().mockResolvedValue({
        candidates: [selectedCandidate],
      }),
      generateCandidate: vi.fn(),
      useCandidate: vi.fn(),
      clearCandidates: vi.fn(),
    };
    const onClearSelected = vi.fn();

    function ControlledPanel() {
      const [selection, setSelection] = useState({
        candidateId: selectedCandidate.id,
        fileId: selectedCandidate.fileId,
        targetRatioPercent: 1,
      });
      return (
        <MeshOptimizationPanel
          pageId="page-1"
          entityType={TranscodeEntityType.PAGE}
          sectionId="section-1"
          unitId="unit-1"
          sourceFile={{
            fileId: 'source-mesh',
            name: 'source.glb',
            size: '22 MB',
            sizeBytes: 22 * 1024 * 1024,
          }}
          selection={selection.candidateId ? selection : null}
          controls={controls}
          onUseCandidate={(candidate) =>
            setSelection({
              candidateId: candidate.id,
              fileId: candidate.fileId,
              targetRatioPercent: candidate.targetRatioPercent,
            })
          }
          onClearSelected={() => {
            onClearSelected();
            setSelection({
              candidateId: '',
              fileId: '',
              targetRatioPercent: 1,
            });
          }}
          t={translateMeshOptimization}
        />
      );
    }

    render(<ControlledPanel />);
    await flushEffects();

    const selected = screen.queryByRole('group', { name: 'Selected compressed GLB' });
    expect(selected?.textContent).toContain('Selected compressed GLB');
    expect(selected?.textContent).toContain('1%');
    expect(selected?.textContent).toContain('compressed-mesh.glb');

    const slider = screen.getByRole('slider', { name: 'Target mesh ratio' });
    expect(slider).toHaveValue('1');
    expect(screen.queryByRole('button', { name: 'Use compressed GLB' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Use original GLB' }));
    expect(onClearSelected).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Use compressed GLB' })).toBeVisible();
  });

  it('deletes an available candidate through the candidate-specific clear request', async () => {
    const completedCandidate = {
      id: 'candidate-to-delete',
      sourceFileId: 'source-mesh',
      fileId: 'compressed-mesh',
      url: '/media/mesh/compressed-mesh.glb',
      fileName: 'compressed-mesh.glb',
      fileSize: 1024,
      method: MESH_OPTIMIZATION_METHOD_DRACO,
      targetRatioPercent: 35,
      status: 'completed' as const,
    };
    const clearCandidates = vi.fn().mockResolvedValue({ success: true });
    const controls: ImmersiveSceneMeshOptimizationControls = {
      listCandidates: vi.fn().mockResolvedValue({ candidates: [completedCandidate] }),
      generateCandidate: vi.fn(),
      useCandidate: vi.fn(),
      clearCandidates,
    };

    render(
      <MeshOptimizationPanel
        pageId="page-1"
        entityType={TranscodeEntityType.PAGE}
        sectionId="section-1"
        unitId="unit-1"
        sourceFile={{ fileId: 'source-mesh', name: 'source.glb', size: '8 MB' }}
        selection={null}
        controls={controls}
        onUseCandidate={vi.fn()}
        onClearSelected={vi.fn()}
        t={translateMeshOptimization}
      />,
    );
    await flushEffects();

    await userEvent.click(screen.getByRole('button', { name: 'Delete compressed GLB (35%)' }));

    expect(clearCandidates).toHaveBeenCalledWith({
      sourceFileId: 'source-mesh',
      entityId: 'page-1',
      entityType: TranscodeEntityType.PAGE,
      sectionId: 'section-1',
      unitId: 'unit-1',
      candidateId: 'candidate-to-delete',
    });
    expect(screen.queryByRole('group', { name: '35%' })).toBeNull();
    expect(screen.getByText('Compressed GLB deleted.')).toBeVisible();
  });

  it('clears the durable selection after deleting the selected candidate', async () => {
    const selectedCandidate = {
      id: 'selected-candidate',
      sourceFileId: 'source-mesh',
      fileId: 'compressed-mesh',
      url: '/media/mesh/compressed-mesh.glb',
      fileName: 'compressed-mesh.glb',
      fileSize: 1024,
      method: MESH_OPTIMIZATION_METHOD_DRACO,
      targetRatioPercent: 1,
      status: 'completed' as const,
    };
    const clearCandidates = vi.fn().mockResolvedValue({ success: true });
    const onClearSelected = vi.fn();
    const controls: ImmersiveSceneMeshOptimizationControls = {
      listCandidates: vi.fn().mockResolvedValue({ candidates: [selectedCandidate] }),
      generateCandidate: vi.fn(),
      useCandidate: vi.fn(),
      clearCandidates,
    };

    function ControlledPanel() {
      const [selection, setSelection] = useState<MeshOptimizationSelection | null>({
        candidateId: selectedCandidate.id,
        fileId: selectedCandidate.fileId,
        targetRatioPercent: selectedCandidate.targetRatioPercent,
      });
      return (
        <MeshOptimizationPanel
          pageId="page-1"
          entityType={TranscodeEntityType.PAGE}
          sectionId="section-1"
          unitId="unit-1"
          sourceFile={{ fileId: 'source-mesh', name: 'source.glb', size: '8 MB' }}
          selection={selection}
          controls={controls}
          onUseCandidate={vi.fn()}
          onClearSelected={() => {
            onClearSelected();
            setSelection(null);
          }}
          t={translateMeshOptimization}
        />
      );
    }

    render(<ControlledPanel />);
    await flushEffects();

    await userEvent.click(screen.getByRole('button', { name: 'Delete compressed GLB (1%)' }));

    expect(clearCandidates).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateId: 'selected-candidate',
        sourceFileId: 'source-mesh',
      }),
    );
    expect(onClearSelected).toHaveBeenCalledOnce();
    expect(screen.queryByRole('group', { name: 'Selected compressed GLB' })).toBeNull();
    expect(screen.getByText('Compressed GLB deleted.')).toBeVisible();
  });

  it('does not restore a deleted running candidate from an older polling response', async () => {
    vi.useFakeTimers();
    const processingCandidate = {
      id: 'processing-candidate',
      sourceFileId: 'source-mesh',
      fileId: '',
      url: '',
      fileName: '',
      fileSize: 0,
      method: MESH_OPTIMIZATION_METHOD_DRACO,
      targetRatioPercent: 55,
      status: 'processing' as const,
    };
    let resolveStaleList!: (result: { candidates: Array<typeof processingCandidate> }) => void;
    const staleList = new Promise<{ candidates: Array<typeof processingCandidate> }>((resolve) => {
      resolveStaleList = resolve;
    });
    const listCandidates = vi
      .fn()
      .mockResolvedValueOnce({ candidates: [processingCandidate] })
      .mockReturnValueOnce(staleList);
    const controls: ImmersiveSceneMeshOptimizationControls = {
      listCandidates,
      generateCandidate: vi.fn(),
      useCandidate: vi.fn(),
      clearCandidates: vi.fn().mockResolvedValue({ success: true }),
    };

    render(
      <MeshOptimizationPanel
        pageId="page-1"
        entityType={TranscodeEntityType.PAGE}
        sectionId="section-1"
        unitId="unit-1"
        sourceFile={{ fileId: 'source-mesh', name: 'source.glb', size: '8 MB' }}
        selection={null}
        controls={controls}
        onUseCandidate={vi.fn()}
        onClearSelected={vi.fn()}
        t={translateMeshOptimization}
      />,
    );
    await act(async () => {
      await listCandidates.mock.results[0]!.value;
    });

    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });
    expect(listCandidates).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole('button', { name: 'Delete compressed GLB (55%)' }));
    await act(async () => {
      await vi.mocked(controls.clearCandidates).mock.results[0]!.value;
    });
    expect(screen.queryByRole('group', { name: '55%' })).toBeNull();

    await act(async () => {
      resolveStaleList({ candidates: [processingCandidate] });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.queryByRole('group', { name: '55%' })).toBeNull();
  });
  it('keeps a new source loading and ignores an older source response', async () => {
    let resolveOld!: (value: { candidates: [] }) => void;
    let resolveNew!: (value: { candidates: [] }) => void;
    const listCandidates = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOld = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveNew = resolve;
          }),
      );
    const controls = { listCandidates, generateCandidate: vi.fn(), useCandidate: vi.fn(), clearCandidates: vi.fn() };
    const props = {
      pageId: 'page-1',
      entityType: TranscodeEntityType.PAGE,
      sectionId: 'section-1',
      unitId: 'unit-1',
      selection: null,
      controls,
      onUseCandidate: vi.fn(),
      onClearSelected: vi.fn(),
      t: translateMeshOptimization,
    };
    const { rerender } = render(
      <MeshOptimizationPanel {...props} sourceFile={{ fileId: 'old', name: 'old.glb', size: '1 MB' }} />,
    );
    expect(screen.getByRole('button', { name: 'Compress GLB' })).toBeDisabled();
    rerender(<MeshOptimizationPanel {...props} sourceFile={{ fileId: 'new', name: 'new.glb', size: '1 MB' }} />);
    await act(async () => resolveOld({ candidates: [] }));
    expect(screen.getByRole('button', { name: 'Compress GLB' })).toBeDisabled();
    await act(async () => resolveNew({ candidates: [] }));
    expect(screen.getByRole('button', { name: 'Compress GLB' })).toBeEnabled();
  });
  it('does not drop a generated candidate when an older poll completes', async () => {
    vi.useFakeTimers();
    const initial = {
      id: 'running-old',
      sourceFileId: 'source-mesh',
      fileId: '',
      url: '',
      fileName: '',
      fileSize: 0,
      method: MESH_OPTIMIZATION_METHOD_DRACO,
      targetRatioPercent: 55,
      status: 'processing' as const,
    };
    const generated = { ...initial, id: 'running-new', targetRatioPercent: 70 };
    let finishPoll!: (value: { candidates: (typeof initial)[] }) => void;
    const listCandidates = vi
      .fn()
      .mockResolvedValueOnce({ candidates: [initial] })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishPoll = resolve;
          }),
      );
    const generateCandidate = vi.fn().mockResolvedValue({ candidate: generated });
    const controls = { listCandidates, generateCandidate, useCandidate: vi.fn(), clearCandidates: vi.fn() };
    render(
      <MeshOptimizationPanel
        pageId="page-1"
        entityType={TranscodeEntityType.PAGE}
        sectionId="section-1"
        unitId="unit-1"
        sourceFile={{ fileId: 'source-mesh', name: 'source.glb', size: '1 MB' }}
        selection={null}
        controls={controls}
        onUseCandidate={vi.fn()}
        onClearSelected={vi.fn()}
        t={translateMeshOptimization}
      />,
    );
    await act(async () => {
      await listCandidates.mock.results[0]!.value;
    });
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(listCandidates).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Compress GLB' }));
    await act(async () => {
      await generateCandidate.mock.results[0]!.value;
    });
    expect(screen.getByRole('group', { name: '70%' })).toBeVisible();
    await act(async () => finishPoll({ candidates: [initial] }));
    expect(screen.getByRole('group', { name: '70%' })).toBeVisible();
  });
});
