'use client';

import { useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Switch } from '@/components/core/Input';

interface AudienceArchiveFilterViewProps {
  includeArchived: boolean;
  pending?: boolean;
  onChange: (includeArchived: boolean) => void;
}

export function AudienceArchiveFilterView({
  includeArchived,
  onChange,
  pending = false,
}: AudienceArchiveFilterViewProps) {
  const t = useTranslations('adminList.audienceSegments');
  const tStates = useTranslations('common.states');

  return (
    <div role="group" aria-label={t('includeArchived')} aria-busy={pending}>
      <Switch
        label={t('includeArchived')}
        disabled={pending}
        aria-busy={pending}
        description={pending ? tStates('loading') : undefined}
        checked={includeArchived}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
    </div>
  );
}

export function AudienceArchiveFilter() {
  const [pending, startTransition] = useTransition();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const includeArchived = searchParams.get('includeArchived') === 'true';

  const updateIncludeArchived = (nextValue: boolean) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (nextValue) {
      nextParams.set('includeArchived', 'true');
    } else {
      nextParams.delete('includeArchived');
    }

    const tableQuery = nextParams.get('segments');
    if (tableQuery) {
      try {
        const parsed = JSON.parse(tableQuery) as Record<string, unknown>;
        delete parsed.page;
        if (Object.keys(parsed).length === 0) {
          nextParams.delete('segments');
        } else {
          nextParams.set('segments', JSON.stringify(parsed));
        }
      } catch {
        nextParams.delete('segments');
      }
    }

    const query = nextParams.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  };

  return (
    <AudienceArchiveFilterView pending={pending} includeArchived={includeArchived} onChange={updateIncludeArchived} />
  );
}
