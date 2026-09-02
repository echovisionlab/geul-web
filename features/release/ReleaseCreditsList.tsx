'use client';

import { Stack } from '@mantine/core';
import { CreditList } from '@/features/work/CreditList';

interface ReleaseCreditEntry {
  id: string;
  name: string;
  href: string | null;
  imageUrl: string | null;
  note?: string | null;
}

interface ReleaseCreditGroup {
  id: string;
  name: string;
  entries: ReleaseCreditEntry[];
}

interface ReleaseCreditsListProps {
  groups: ReleaseCreditGroup[];
  unknownLabel: string;
}

export function ReleaseCreditsList({ groups, unknownLabel }: ReleaseCreditsListProps) {
  return (
    <Stack gap={4}>
      {groups.map((group) => (
        <CreditList.Group key={group.id} name={group.name}>
          {group.entries.map((entry) => (
            <CreditList.Item
              key={entry.id}
              name={entry.name || unknownLabel}
              imageUrl={entry.imageUrl}
              href={entry.href}
              note={entry.note}
            />
          ))}
        </CreditList.Group>
      ))}
    </Stack>
  );
}
