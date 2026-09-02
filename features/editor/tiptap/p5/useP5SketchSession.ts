import { useCallback, useEffect, useRef, useState } from 'react';
import type { NodeViewProps } from '@tiptap/react';
import { replaceExecutableSource } from '../executable-source';
import { serializeP5Capabilities, type P5Capability } from './p5-capabilities';
import type { P5SketchMode } from './p5-node-options';
import type { P5PreviewRuntime } from './p5-preview-runtime';

interface UseP5SketchSessionOptions {
  editor: NodeViewProps['editor'];
  getPos: NodeViewProps['getPos'];
  node: NodeViewProps['node'];
  updateAttributes: NodeViewProps['updateAttributes'];
  editable: boolean;
  canEditNeutral: boolean;
  durableMode: P5SketchMode;
  originalSource: string;
  capabilities: readonly P5Capability[];
  hasDeviceCapabilities: boolean;
  autoRunReadOnly: boolean;
}

export function useP5SketchSession({
  editor,
  getPos,
  node,
  updateAttributes,
  editable,
  canEditNeutral,
  durableMode,
  originalSource,
  capabilities,
  hasDeviceCapabilities,
  autoRunReadOnly,
}: UseP5SketchSessionOptions) {
  const [publicMode, setPublicMode] = useState<P5SketchMode>('preview');
  const [temporarySource, setTemporarySource] = useState(originalSource);
  const [draftSource, setDraftSource] = useState(originalSource);
  const [hasTemporaryFork, setHasTemporaryFork] = useState(false);
  const initialRunning = hasDeviceCapabilities
    ? false
    : canEditNeutral
      ? durableMode !== 'source'
      : !editable && autoRunReadOnly;
  const [running, setRunning] = useState(initialRunning);
  const [revision, setRevision] = useState(initialRunning ? 1 : 0);
  const [copied, setCopied] = useState(false);
  const runtimeRef = useRef<P5PreviewRuntime | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mode = canEditNeutral ? durableMode : publicMode;
  const source = hasTemporaryFork ? temporarySource : originalSource;
  const appliedSourceRef = useRef(source);
  const previousSource = useRef(source);
  const hasDraftChanges = draftSource !== source;
  const codeVisible = mode !== 'preview';

  useEffect(() => {
    if (!hasTemporaryFork) {
      setTemporarySource(originalSource);
    }
  }, [hasTemporaryFork, originalSource]);

  useEffect(() => {
    const previousAppliedSource = appliedSourceRef.current;
    appliedSourceRef.current = source;
    setDraftSource((current) => (current === previousAppliedSource ? source : current));
  }, [source]);

  useEffect(() => {
    if (editable || !hasTemporaryFork || mode !== 'edit' || hasDeviceCapabilities) {
      return;
    }
    setRunning(true);
    setRevision((value) => value + 1);
  }, [editable, hasDeviceCapabilities, hasTemporaryFork, mode, temporarySource]);

  useEffect(() => {
    if (previousSource.current === source) {
      return;
    }
    previousSource.current = source;
    if (hasDeviceCapabilities) {
      runtimeRef.current?.stop();
      setRunning(false);
      return;
    }
    if (mode !== 'edit' || !canEditNeutral) {
      return;
    }
    setRunning(true);
    setRevision((value) => value + 1);
  }, [canEditNeutral, hasDeviceCapabilities, mode, source]);

  useEffect(
    () => () => {
      runtimeRef.current?.dispose();
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    },
    [],
  );

  const setRuntime = useCallback((runtime: P5PreviewRuntime | null) => {
    runtimeRef.current = runtime;
  }, []);
  const markInactive = useCallback(() => setRunning(false), []);
  const setMode = useCallback(
    (nextMode: P5SketchMode) => {
      if (canEditNeutral) {
        updateAttributes({ mode: nextMode });
      } else {
        setPublicMode(nextMode);
      }
      if (nextMode !== 'source' && !hasDeviceCapabilities) {
        setRunning(true);
        setRevision((value) => value + 1);
      } else {
        runtimeRef.current?.stop();
        setRunning(false);
      }
    },
    [canEditNeutral, hasDeviceCapabilities, updateAttributes],
  );
  const stop = useCallback(() => {
    runtimeRef.current?.stop();
    setRunning(false);
  }, []);
  const restart = useCallback(() => {
    setRunning(true);
    setRevision((value) => value + 1);
  }, []);
  const toggleCapability = useCallback(
    (capability: P5Capability) => {
      if (!canEditNeutral) {
        return;
      }
      runtimeRef.current?.stop();
      setRunning(false);
      const nextCapabilities = capabilities.includes(capability)
        ? capabilities.filter((candidate) => candidate !== capability)
        : [...capabilities, capability];
      updateAttributes({ capabilities: serializeP5Capabilities(nextCapabilities) });
    },
    [canEditNeutral, capabilities, updateAttributes],
  );
  const resetOriginal = useCallback(() => {
    const requiresSourceReset = temporarySource !== originalSource;
    setTemporarySource(originalSource);
    setDraftSource(originalSource);
    if (!requiresSourceReset && !hasDeviceCapabilities) {
      restart();
    }
  }, [hasDeviceCapabilities, originalSource, restart, temporarySource]);
  const applyDraft = useCallback(() => {
    if (!hasDraftChanges) {
      return;
    }
    if (canEditNeutral) {
      replaceExecutableSource({ editor, getPos, node }, draftSource);
    } else if (!editable && hasTemporaryFork) {
      setTemporarySource(draftSource);
    }
  }, [canEditNeutral, draftSource, editable, editor, getPos, hasDraftChanges, hasTemporaryFork, node]);
  const toggleSource = useCallback(() => {
    if (codeVisible) {
      setMode('preview');
      return;
    }
    if (!editable && !hasTemporaryFork) {
      setHasTemporaryFork(true);
      setTemporarySource(originalSource);
      setDraftSource(originalSource);
    }
    setMode(canEditNeutral || !editable ? 'edit' : 'source');
  }, [canEditNeutral, codeVisible, editable, hasTemporaryFork, originalSource, setMode]);
  const copySource = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(mode === 'edit' ? draftSource : source);
      setCopied(true);
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = setTimeout(() => setCopied(false), 1_000);
    } catch {
      setCopied(false);
    }
  }, [draftSource, mode, source]);

  return {
    mode,
    source,
    draftSource,
    setDraftSource,
    temporarySource,
    hasDraftChanges,
    codeVisible,
    running,
    revision,
    copied,
    setRuntime,
    markInactive,
    setMode,
    stop,
    restart,
    toggleCapability,
    resetOriginal,
    applyDraft,
    toggleSource,
    copySource,
  };
}
