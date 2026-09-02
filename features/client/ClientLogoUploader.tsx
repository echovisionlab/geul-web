'use client';

import { useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { LogoCropper } from '@/features/site/LogoCropper/LogoCropper';
import { deleteClientLogoAction, setClientLogoAction, type ThemeAssetVariantName } from '@/lib/actions/client';
import { useUpload } from '@/lib/hooks/useUpload';
import { UploadType } from '@/lib/types/upload/model';

export interface ClientLogoUploaderProps {
  /** Client ID to upload logo for */
  clientId: string;
  /** Current logo URL */
  currentImage: string | null | undefined;
  /** Theme variant this uploader owns */
  variant?: ThemeAssetVariantName;
  /** Client's display name */
  name?: string | null;
  /** Logo display size */
  size?: number;
  /** Label text */
  label?: string;
  /** Called after successful upload or delete with the new URL */
  onImageChange?: (url: string | null) => void;
}

/**
 * Feature wrapper for LogoCropper that handles client logo upload logic.
 *
 * Uses the unified upload system:
 * 1. Upload file to generic file table via useUpload hook
 * 2. Link file to client via setLogo mutation
 *
 * @example
 * ```tsx
 * <ClientLogoUploader
 *   clientId={client.id}
 *   currentImage={client.logo_url}
 *   name={client.name}
 *   onImageChange={(url) => setLogoUrl(url)}
 * />
 * ```
 */
export function ClientLogoUploader({
  clientId,
  currentImage,
  variant = 'light',
  name,
  size = 120,
  label = 'Logo',
  onImageChange,
}: ClientLogoUploaderProps) {
  // Unified upload hook for file storage
  const { upload } = useUpload(UploadType.CLIENT_LOGO);

  // Mutations for linking file to client and deletion
  const setLogo = useMutation({
    mutationFn: (data: { clientId: string; fileId: string }) =>
      setClientLogoAction(data.clientId, data.fileId, variant),
  });

  const deleteLogo = useMutation({
    mutationFn: (data: { clientId: string }) => deleteClientLogoAction(data.clientId, variant),
  });

  const handleUpload = useCallback(
    async (data: Uint8Array<ArrayBuffer>, mimeType: string): Promise<{ url: string }> => {
      // Convert Uint8Array to Blob for upload
      const blob = new Blob([data], { type: mimeType });

      // Upload to file table
      const { fileId, url } = await upload(blob, {
        entityId: clientId,
        fileName: `logo-${variant}`,
        slotId: `logo_${variant}`,
      });

      // Link file to client
      const result = await setLogo.mutateAsync({ clientId, fileId });
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        throw new Error(result.error);
      }

      return { url };
    },
    [clientId, upload, setLogo, variant],
  );

  const handleDelete = useCallback(async () => {
    const result = await deleteLogo.mutateAsync({ clientId });
    if (result.error) {
      notifications.show({ message: result.error, color: 'red' });
      throw new Error(result.error);
    }
    return result;
  }, [clientId, deleteLogo]);

  const handleImageChange = useCallback(
    async (url: string | null) => {
      onImageChange?.(url);
    },
    [onImageChange],
  );

  return (
    <LogoCropper
      currentImage={currentImage}
      name={name}
      size={size}
      label={label}
      onUpload={handleUpload}
      onDelete={handleDelete}
      onImageChange={handleImageChange}
    />
  );
}
