'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface Options {
  abortMeshUpload: () => void;
  abortTextureUpload: () => void;
}

export function useImmersiveAssetUploadController({ abortMeshUpload, abortTextureUpload }: Options) {
  const [uploadingAssetKeys, setUploadingAssetKeys] = useState<Set<string>>(() => new Set());
  const [assetUploadProgress, setAssetUploadProgress] = useState<Map<string, number>>(() => new Map());
  const uploadingAssetKeysRef = useRef<Set<string>>(new Set());
  const uploadGenerationsRef = useRef<Map<string, number>>(new Map());
  const fileInputResetCallbacksRef = useRef<Map<string, () => void>>(new Map());
  const abortMeshUploadRef = useRef(abortMeshUpload);
  const abortTextureUploadRef = useRef(abortTextureUpload);

  useEffect(() => {
    abortMeshUploadRef.current = abortMeshUpload;
    abortTextureUploadRef.current = abortTextureUpload;
  }, [abortMeshUpload, abortTextureUpload]);

  const setAssetUploading = useCallback((assetKey: string, uploading: boolean) => {
    const nextRef = new Set(uploadingAssetKeysRef.current);
    if (uploading) {
      nextRef.add(assetKey);
    } else {
      nextRef.delete(assetKey);
    }
    uploadingAssetKeysRef.current = nextRef;
    setUploadingAssetKeys(nextRef);
  }, []);

  const setAssetProgress = useCallback((assetKey: string, percentage?: number) => {
    setAssetUploadProgress((current) => {
      const next = new Map(current);
      if (percentage == null) {
        next.delete(assetKey);
      } else {
        next.set(assetKey, Math.max(0, Math.min(100, percentage)));
      }
      return next;
    });
  }, []);

  const setAssetFileInputReset = useCallback((assetKey: string, reset: (() => void) | null) => {
    if (reset) {
      fileInputResetCallbacksRef.current.set(assetKey, reset);
    } else {
      fileInputResetCallbacksRef.current.delete(assetKey);
    }
  }, []);

  const resetAssetFileInput = useCallback((assetKey: string) => {
    fileInputResetCallbacksRef.current.get(assetKey)?.();
  }, []);

  const beginAssetUpload = useCallback(
    (assetKey: string) => {
      const generation = (uploadGenerationsRef.current.get(assetKey) ?? 0) + 1;
      uploadGenerationsRef.current.set(assetKey, generation);
      setAssetUploading(assetKey, true);
      setAssetProgress(assetKey, 0);
      return generation;
    },
    [setAssetProgress, setAssetUploading],
  );

  const isCurrentAssetUpload = useCallback((assetKey: string, generation: number) => {
    return uploadGenerationsRef.current.get(assetKey) === generation;
  }, []);

  const finishAssetUpload = useCallback(
    (assetKey: string, generation: number) => {
      if (!isCurrentAssetUpload(assetKey, generation)) {
        return;
      }
      uploadGenerationsRef.current.delete(assetKey);
      setAssetUploading(assetKey, false);
      setAssetProgress(assetKey);
    },
    [isCurrentAssetUpload, setAssetProgress, setAssetUploading],
  );

  const cancelAssetUpload = useCallback(
    (assetKey: string) => {
      uploadGenerationsRef.current.set(assetKey, (uploadGenerationsRef.current.get(assetKey) ?? 0) + 1);
      setAssetUploading(assetKey, false);
      setAssetProgress(assetKey);
      resetAssetFileInput(assetKey);
    },
    [resetAssetFileInput, setAssetProgress, setAssetUploading],
  );

  const cancelMeshUpload = useCallback(
    (assetKey: string) => {
      cancelAssetUpload(assetKey);
      abortMeshUpload();
    },
    [abortMeshUpload, cancelAssetUpload],
  );

  const cancelTextureUpload = useCallback(
    (assetKey: string) => {
      cancelAssetUpload(assetKey);
      abortTextureUpload();
    },
    [abortTextureUpload, cancelAssetUpload],
  );

  const cancelUnitUploads = useCallback(
    (unitId: string) => {
      const meshKey = `${unitId}:mesh`;
      const textureKey = `${unitId}:light-texture`;
      const darkTextureKey = `${unitId}:dark-texture`;
      const hadMeshUpload = uploadingAssetKeysRef.current.has(meshKey);
      const hadTextureUpload =
        uploadingAssetKeysRef.current.has(textureKey) || uploadingAssetKeysRef.current.has(darkTextureKey);

      cancelAssetUpload(meshKey);
      cancelAssetUpload(textureKey);
      cancelAssetUpload(darkTextureKey);
      if (hadMeshUpload) {
        abortMeshUpload();
      }
      if (hadTextureUpload) {
        abortTextureUpload();
      }
    },
    [abortMeshUpload, abortTextureUpload, cancelAssetUpload],
  );

  useEffect(
    () => () => {
      if (uploadingAssetKeysRef.current.size === 0) {
        return;
      }
      uploadGenerationsRef.current.clear();
      uploadingAssetKeysRef.current = new Set();
      abortMeshUploadRef.current();
      abortTextureUploadRef.current();
    },
    [],
  );

  return {
    uploadingAssetKeys,
    assetUploadProgress,
    beginAssetUpload,
    isCurrentAssetUpload,
    finishAssetUpload,
    cancelMeshUpload,
    cancelTextureUpload,
    cancelUnitUploads,
    setAssetProgress,
    setAssetFileInputReset,
    resetAssetFileInput,
  };
}
