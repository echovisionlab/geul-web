'use client';

import { useCallback } from 'react';
import { getUploadSelectionMimeTypes } from '@/lib/constants/upload-config';
import type { UploadType } from '@/lib/types/upload/model';
import { toAcceptString } from '@/lib/utils/upload';
import { validateUploadSelectionFile } from '@/lib/utils/upload-pipeline';

export type ValidationResult = { valid: true } | { valid: false; error: string };

/**
 * Hook for client-side file validation against upload constraints.
 *
 * @example
 * ```tsx
 * function MyUploader() {
 *   const { validateFile, getAcceptString } = useUploadValidation();
 *
 *   const handleFileSelect = (file: File) => {
 *     const result = validateFile(file);
 *     if (!result.valid) {
 *       showError(result.error);
 *       return;
 *     }
 *     // proceed with upload
 *   };
 *
 *   return <input type="file" accept={getAcceptString('editorImage')} />;
 * }
 * ```
 */
export function useUploadValidation() {
  /**
   * Validate a file against upload constraints.
   * @param file - The file to validate
   * @param uploadType - Optional upload type. If not provided, determined from MIME type.
   */
  const validateFile = useCallback((file: File, uploadType?: UploadType): ValidationResult => {
    const validation = validateUploadSelectionFile(file, uploadType);
    if (!validation.valid) {
      return { valid: false, error: validation.error };
    }
    return { valid: true };
  }, []);

  /**
   * Get HTML accept attribute string for file input.
   * @param uploadType - The upload type to get accept string for
   */
  const getAcceptString = useCallback((uploadType: UploadType): string => {
    return toAcceptString(getUploadSelectionMimeTypes(uploadType));
  }, []);

  return { validateFile, getAcceptString };
}
