'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Switch } from '@/components/core/Input';

interface AudienceArchiveFilterViewProps {
  includeArchived: boolean;
  onChange: (includeArchived: boolean) => void;
}

export function AudienceArchiveFilterView({ includeArchived, onChange }: AudienceArchiveFilterViewProps) {
  const t = useTranslations('adminList.audienceSegments');

  return (
    <Switch
      label={t('includeArchived')}
      checked={includeArchived}
      onChange={(event) => onChange(event.currentTarget.checked)}
    />
  );
}

export function AudienceArchiveFilter() {
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
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return <AudienceArchiveFilterView includeArchived={includeArchived} onChange={updateIncludeArchived} />;
}
