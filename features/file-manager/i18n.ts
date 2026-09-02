'use client';

import { useCallback } from 'react';
import { MediaProcessingStatus } from '@echovisionlab/geul-proto/common/media_pb.ts';
import { FileDerivativeType, FileUsageDomain } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { useTranslations } from 'next-intl';
import type { FileManagerActionErrorCode } from '@/lib/actions/file';
import type { FileManagerViewLabels } from './FileManagerView';

export type FileManagerErrorKey = FileManagerActionErrorCode | 'load' | 'mutation' | 'upload' | 'inUse';

export function useFileManagerI18n() {
  const t = useTranslations('fileManager');
  const entityT = useTranslations('common.entities');
  const siteSettingsT = useTranslations('adminSettings.site');
  const errorMessage = useCallback((key: FileManagerErrorKey) => t(`errors.${key}`), [t]);

  const labels: FileManagerViewLabels = {
    title: t('title'),
    description: t('description'),
    root: t('root'),
    search: t('search'),
    allTypes: t('types.all'),
    images: t('types.images'),
    audio: t('types.audio'),
    video: t('types.video'),
    documents: t('types.documents'),
    folderType: t('types.folder'),
    sortName: t('sort.name'),
    sortNewest: t('sort.newest'),
    sortOldest: t('sort.oldest'),
    sortSize: t('sort.size'),
    sortSmallest: t('sort.smallest'),
    sortLabel: t('sort.label'),
    upload: t('actions.upload'),
    newFolder: t('actions.newFolder'),
    open: t('actions.open'),
    preview: t('actions.preview'),
    move: t('actions.move'),
    moveHere: t('actions.moveHere'),
    chooseDestination: t('dialogs.chooseDestination'),
    delete: t('actions.delete'),
    rename: t('actions.rename'),
    download: t('actions.download'),
    close: t('actions.close'),
    cancel: t('actions.cancel'),
    gridView: t('actions.gridView'),
    listView: t('actions.listView'),
    loadMore: t('actions.loadMore'),
    name: t('columns.name'),
    type: t('columns.type'),
    size: t('columns.size'),
    location: t('columns.location'),
    uploadedBy: t('columns.uploadedBy'),
    uploadedAt: t('columns.uploadedAt'),
    usages: t('columns.usages'),
    usageStatus: t('columns.usageStatus'),
    inUse: t('inUse'),
    notInUse: t('notInUse'),
    usageDomains: {
      [FileUsageDomain.POST]: entityT('post'),
      [FileUsageDomain.PAGE]: entityT('page'),
      [FileUsageDomain.WORK]: entityT('work'),
      [FileUsageDomain.SITE_SETTINGS]: siteSettingsT('title'),
      [FileUsageDomain.RELEASE]: entityT('release'),
      [FileUsageDomain.TRACK]: entityT('track'),
      [FileUsageDomain.ARTIST]: entityT('artist'),
      [FileUsageDomain.LABEL]: entityT('label'),
      [FileUsageDomain.CLIENT]: entityT('client'),
      [FileUsageDomain.SERIES]: entityT('series'),
      [FileUsageDomain.FORM]: entityT('form'),
      [FileUsageDomain.PROGRAM_EVENT]: entityT('programEvent'),
      [FileUsageDomain.MAP_PLACE]: entityT('mapPlace'),
    },
    usageSlots: {
      logo_light: siteSettingsT('assets.logo_light.label'),
      logo_dark: siteSettingsT('assets.logo_dark.label'),
      logo_email: siteSettingsT('assets.logo_email.label'),
      favicon: siteSettingsT('assets.favicon.label'),
      loader: siteSettingsT('assets.loader.label'),
      site_og_background: siteSettingsT('assets.site_og_background.label'),
      privacy_og_background: siteSettingsT('assets.privacy_og_background.label'),
      terms_og_background: siteSettingsT('assets.terms_og_background.label'),
    },
    generatedOutputs: t('generatedOutputs.title'),
    generatedOutputTypes: {
      [FileDerivativeType.THUMBNAIL]: t('generatedOutputs.types.thumbnail'),
      [FileDerivativeType.HLS]: t('generatedOutputs.types.hls'),
      [FileDerivativeType.SPECTROGRAM]: t('generatedOutputs.types.spectrogram'),
      [FileDerivativeType.WAVEFORM]: t('generatedOutputs.types.waveform'),
      [FileDerivativeType.FAVICON_ICO]: t('generatedOutputs.types.favicon'),
      [FileDerivativeType.FAVICON_PNG_16]: t('generatedOutputs.types.favicon'),
      [FileDerivativeType.FAVICON_PNG_32]: t('generatedOutputs.types.favicon'),
      [FileDerivativeType.FAVICON_PNG_48]: t('generatedOutputs.types.favicon'),
      [FileDerivativeType.FAVICON_APPLE_TOUCH_180]: t('generatedOutputs.types.favicon'),
      [FileDerivativeType.FAVICON_MANIFEST_192]: t('generatedOutputs.types.favicon'),
      [FileDerivativeType.FAVICON_MANIFEST_512]: t('generatedOutputs.types.favicon'),
      [FileDerivativeType.OPTIMIZED_MESH]: t('generatedOutputs.types.optimizedMesh'),
    },
    processingStatuses: {
      [MediaProcessingStatus.PROCESSING]: t('generatedOutputs.status.processing'),
      [MediaProcessingStatus.READY]: t('generatedOutputs.status.ready'),
      [MediaProcessingStatus.FAILED]: t('generatedOutputs.status.failed'),
    },
    adminOnly: t('adminOnly'),
    actions: t('columns.actions'),
    empty: t('empty'),
    folderNotFound: t('folderNotFound'),
    returnToRoot: t('actions.returnToRoot'),
    unknownMember: t('unknownMember'),
    deletedMember: t('deletedMember'),
    selectAll: t('selectAll'),
    selectItem: (name) => t('selectItem', { name }),
    sortBy: (name) => t('sortBy', { name }),
    selectedCount: (count) => t('selectedCount', { count }),
    itemCount: (count) => t('itemCount', { count }),
    searchResultCount: (count) => t('searchResultCount', { count }),
    uploadProgress: (percentage) => t('uploadProgress', { percentage }),
  };

  return {
    labels,
    errorMessage,
    message: t,
  };
}
