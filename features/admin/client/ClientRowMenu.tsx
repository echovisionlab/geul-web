'use client';

import { EntityRowMenu } from '@/features/admin/EntityRowMenu';
import { useClientModal, type ClientModalTarget } from './ClientModalContext';

interface ClientRowMenuProps {
  client: ClientModalTarget;
}

export function ClientRowMenu({ client }: ClientRowMenuProps) {
  const { openDelete } = useClientModal();
  return (
    <EntityRowMenu entity={client} label={client.name} editHref={`/admin/clients/${client.id}`} onDelete={openDelete} />
  );
}
