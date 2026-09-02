'use client';

import { useRouter } from 'next/navigation';
import { IconTrash } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconButton } from '@/components/core/IconButton';
import { ConfirmModal } from '@/components/core/Modal';
import { Tooltip } from '@/components/core/Tooltip';
import { deleteFormSubmissionAction } from '@/lib/actions/form';

interface Props {
  submissionId: string;
  formId: string;
  returnHref?: string;
}

export function SubmissionDeleteButton({ submissionId, formId, returnHref }: Props) {
  const router = useRouter();
  const t = useTranslations('formAdmin.submissions');
  const tCommonActions = useTranslations('common.actions');
  const [opened, { open, close }] = useDisclosure(false);

  const deleteSubmission = useMutation({
    mutationFn: () => deleteFormSubmissionAction(submissionId),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({ message: t('notifications.deleted'), color: 'red' });
      router.push(returnHref ?? `/forms/${encodeURIComponent(formId)}?edit=true&tab=submissions`);
    },
    onError: (error) => {
      notifications.show({ message: error.message, color: 'red' });
    },
  });

  return (
    <>
      <Tooltip label={tCommonActions('delete')}>
        <IconButton tone="danger" emphasis="low" size="sm" aria-label={tCommonActions('delete')} onClick={open}>
          <IconTrash size={16} />
        </IconButton>
      </Tooltip>

      <ConfirmModal
        opened={opened}
        onClose={close}
        onConfirm={() => deleteSubmission.mutate()}
        title={t('deleteModal.title')}
        message={t('deleteModal.body')}
        confirmLabel={tCommonActions('delete')}
        cancelLabel={tCommonActions('cancel')}
        closeLabel={tCommonActions('close')}
        loading={deleteSubmission.isPending}
      />
    </>
  );
}
