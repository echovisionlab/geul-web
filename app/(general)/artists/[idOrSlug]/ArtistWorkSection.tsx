'use client';
import { SupportingText, Text as DsText } from '@/components/core/Typography';

import {
  LayoutInline as DsLayoutInline,
  LayoutInset as DsLayoutInset,
  LayoutStack as DsLayoutStack,
} from '@/components/core/Layout';

import { useId, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from '@/components/core/Navigation';
import { IconFilter } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';

import { LabelBadge } from '@/components/core/Badge';
import { IconButton } from '@/components/core/IconButton';
import { SearchInput } from '@/components/core/Input';
// View pages load menu code on first interaction.
import { OnDemandDropdownMenu as DropdownMenu } from '@/components/core/DropdownMenu/OnDemandDropdownMenu';
import { WORK_TYPES, type WorkType } from '@/lib/types/work/model';
import { EntityDetailSection } from '@/features/document-layout/ui/EntityDetailLayout';
import classes from './page.module.css';

interface Work {
  id: string;
  title: string | null;
  slug: string | null;
  type: string;
  featured_image_url: string | null;
}

interface WorksSectionProps {
  works: Work[];
}

export function ArtistWorkSection({ works }: WorksSectionProps) {
  const t = useTranslations('artistPage.works');
  const tCommonEntities = useTranslations('common.entities');
  const tCommonPlaceholders = useTranslations('common.placeholders');
  const tWorkTypes = useTranslations('works.types');
  const sectionId = useId();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const filteredWorks = useMemo(() => {
    return works.filter((work) => {
      const matchesSearch = !search || work.title?.toLowerCase().includes(search.toLowerCase());
      const matchesType = !typeFilter || work.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [works, search, typeFilter]);

  const getWorkTypeLabel = (type: string) => {
    switch (type as WorkType) {
      case 'music_project':
        return tWorkTypes('music_project');
      case 'portfolio':
        return tWorkTypes('portfolio');
      case 'article':
        return tWorkTypes('article');
      case 'contribution':
        return tWorkTypes('contribution');
      default:
        return type;
    }
  };

  return (
    <EntityDetailSection
      title={tCommonEntities('works')}
      titleId={sectionId}
      actions={
        <DsLayoutInline gap="xs">
          <div style={{ width: 160 }}>
            <SearchInput
              aria-label={tCommonPlaceholders('search')}
              aria-describedby={sectionId}
              placeholder={tCommonPlaceholders('search')}
              size="xs"
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
            />
          </div>
          <DropdownMenu placement="bottom-end" arrow>
            <DropdownMenu.Target>
              <IconButton
                emphasis={typeFilter ? 'medium' : 'low'}
                size="sm"
                tone="neutral"
                aria-label={t('filterByType')}
              >
                <IconFilter size={16} />
              </IconButton>
            </DropdownMenu.Target>
            <DropdownMenu.Dropdown>
              <DropdownMenu.Item onClick={() => setTypeFilter(null)} selected={!typeFilter}>
                {t('allTypes')}
              </DropdownMenu.Item>
              <DropdownMenu.Divider />
              {WORK_TYPES.map((type) => (
                <DropdownMenu.Item key={type} onClick={() => setTypeFilter(type)} selected={typeFilter === type}>
                  {getWorkTypeLabel(type)}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Dropdown>
          </DropdownMenu>
        </DsLayoutInline>
      }
    >
      <DsLayoutStack gap="none">
        {filteredWorks.map((work, index) => {
          const imageUrl = work.featured_image_url;
          return (
            <Link
              key={work.id}
              href={`/works/${work.slug || work.id}`}
              appearance="row"
              separator={index === 0 ? 'none' : 'start'}
              data-first={index === 0 || undefined}
            >
              <div className={classes.workThumb}>
                {imageUrl ? (
                  <Image
                    src={imageUrl}
                    alt={work.title || tCommonEntities('work')}
                    width={48}
                    height={48}
                    style={{ objectFit: 'cover' }}
                  />
                ) : (
                  <DsText size="sm" weight="strong" tone="secondary">
                    {(work.title || '?').charAt(0).toUpperCase()}
                  </DsText>
                )}
              </div>
              <DsText size="sm" weight="medium" lines={1} flexible>
                {work.title}
              </DsText>
              <LabelBadge appearance="soft">{getWorkTypeLabel(work.type)}</LabelBadge>
            </Link>
          );
        })}
        {filteredWorks.length === 0 && (
          <DsLayoutInset block="md">
            <SupportingText tone="secondary" align="center">
              {t('empty')}
            </SupportingText>
          </DsLayoutInset>
        )}
      </DsLayoutStack>
    </EntityDetailSection>
  );
}
