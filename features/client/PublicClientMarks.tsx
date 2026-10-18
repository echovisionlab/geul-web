'use client';

import { LayoutInline } from '@/components/core/Layout';
import { ClientPublicMark, type ClientPublicMarkProps } from './ClientPublicMark';

/** Clients as one metadata value: logos and names on a shared centre line, wrapping as needed. */
export function PublicClientMarks({ clients }: { clients: (ClientPublicMarkProps & { id: string })[] }) {
  return (
    <LayoutInline gap="lg" align="center" wrap="wrap">
      {clients.map(({ id, ...client }) => (
        <ClientPublicMark key={id} {...client} />
      ))}
    </LayoutInline>
  );
}
