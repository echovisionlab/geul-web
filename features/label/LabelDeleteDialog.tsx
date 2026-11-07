'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Alert } from '@/components/core/Alert';
import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { notifications } from '@/components/core/Notification';
import { List, Text as DsText } from '@/components/core/Typography';
import { ConfirmationDialog } from '@/features/confirmation';
import { PageLoader } from '@/features/site/PageLoader';
import { unwrapQueryResult, type QueryValue } from '@/lib/api/query-result';
import { deleteLabelAction, previewDeleteLabelAction } from '@/lib/actions/label';

interface LabelDeleteTarget {
  id: string;
  name: string;
}

interface LabelDeleteDialogProps {
  label: LabelDeleteTarget | null;
  onClose: () => void;
  onDeleted: () => void;
  previewAction?: typeof previewDeleteLabelAction;
  deleteAction?: typeof deleteLabelAction;
}

type LabelDeletePreview = QueryValue<Awaited<ReturnType<typeof previewDeleteLabelAction>>>;

/** Confirms deleting a Label against a fresh impact preview; a failed delete loads a new preview. */
export function LabelDeleteDialog({
  label,
  onClose,
  onDeleted,
  previewAction = previewDeleteLabelAction,
  deleteAction = deleteLabelAction,
}: LabelDeleteDialogProps) {
  const tCommon = useTranslations('common');
  const labelId = label?.id;
  const requestRef = useRef(0);
  const [preview, setPreview] = useState<LabelDeletePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadPreview = useCallback(
    async (id: string) => {
      const request = ++requestRef.current;
      setPreview(null);
      setPreviewLoading(true);
      setPreviewFailed(false);
      try {
        const loaded = await previewAction(id).then(unwrapQueryResult);
        if (request !== requestRef.current) {
          return;
        }
        setPreview(loaded ?? null);
        setPreviewFailed(!loaded);
      } catch {
        if (request === requestRef.current) {
          setPreviewFailed(true);
        }
      } finally {
        if (request === requestRef.current) {
          setPreviewLoading(false);
        }
      }
    },
    [previewAction],
  );

  useEffect(() => {
    setDeleting(false);
    if (labelId) {
      void loadPreview(labelId);
    } else {
      setPreview(null);
      setPreviewFailed(false);
      setPreviewLoading(false);
    }
    return () => {
      requestRef.current += 1;
    };
  }, [labelId, loadPreview]);

  const handleDelete = async () => {
    if (!labelId || !preview) {
      return;
    }
    setDeleting(true);
    try {
      const result = await deleteAction(labelId, preview.revision);
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        await loadPreview(labelId);
        return;
      }
      notifications.show({
        message: tCommon('messages.itemDeleted', { item: tCommon('entities.label') }),
        tone: 'positive',
      });
      onDeleted();
    } finally {
      setDeleting(false);
    }
  };

  if (!label) {
    return null;
  }
  return (
    <ConfirmationDialog
      intent="delete"
      opened
      onClose={onClose}
      onConfirm={handleDelete}
      title={tCommon('actions.delete')}
      message={
        <DsLayoutStack gap="xs">
          <DsText>
            {tCommon.rich('messages.confirmDeleteNamedRich', {
              name: label.name,
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </DsText>
          {previewLoading ? <PageLoader placement="flow" /> : null}
          {previewFailed ? <Alert tone="danger">{tCommon('messages.failedToLoad')}</Alert> : null}
          {preview && preview.impacts.length > 0 ? (
            <>
              <DsText size="sm" tone="warning">
                {tCommon('messages.relatedItemsWillBeUnlinked', { count: preview.impacts.length })}
              </DsText>
              <List size="sm">
                {preview.impacts.map((impact) => (
                  <List.Item key={`${impact.kind}-${impact.entityId}`}>{impact.displayName}</List.Item>
                ))}
              </List>
            </>
          ) : null}
        </DsLayoutStack>
      }
      confirmLabel={tCommon('actions.delete')}
      cancelLabel={tCommon('actions.cancel')}
      closeLabel={tCommon('actions.close')}
      loading={deleting}
      confirmDisabled={previewLoading || previewFailed || !preview}
    />
  );
}
