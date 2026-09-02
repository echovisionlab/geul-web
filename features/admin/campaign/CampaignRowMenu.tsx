'use client';

import { IconSend, IconTrash } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { TableRowMenu, type TableRowMenuItem } from '@/components/core/DataTable';
import { useCampaignModal, type CampaignModalTarget } from './CampaignModalContext';

interface CampaignRowMenuProps {
  campaign: CampaignModalTarget;
}

export function CampaignRowMenu({ campaign }: CampaignRowMenuProps) {
  const tCommon = useTranslations('common');
  const tPage = useTranslations('adminList.campaigns');
  const tTable = useTranslations('dataTable');
  const { openDelete } = useCampaignModal();
  const label = campaign.name || campaign.subject || tCommon('entities.campaign');

  const items: TableRowMenuItem[] = [
    {
      label: tPage('editAndSend'),
      icon: <IconSend size={16} />,
      href: `/campaigns/${campaign.id}?edit=true`,
    },
    {
      label: tCommon('actions.delete'),
      icon: <IconTrash size={16} />,
      onClick: () => openDelete(campaign),
      color: 'red',
      disabled: campaign.status !== 'draft',
    },
  ];

  return <TableRowMenu aria-label={tTable('aria.rowActions', { label })} items={items} />;
}
