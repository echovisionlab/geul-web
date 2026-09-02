'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { IconFilter, IconSearch } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Box, Divider, Group, Stack, Text } from '@mantine/core';
import { LabelBadge } from '@/components/core/Badge';
import { IconButton } from '@/components/core/IconButton';
import { TextInput } from '@/components/core/Input';
import { DropdownMenu } from '@/components/core/DropdownMenu';
import { WORK_TYPES, type WorkType } from '@/lib/types/work/model';
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
    <Box>
      <Group justify="space-between" align="center" mb="xs">
        <Text className={classes.sectionHeader} mb={0}>
          {tCommonEntities('works')}
        </Text>
        <Group gap="xs">
          <TextInput
            placeholder={tCommonPlaceholders('search')}
            size="xs"
            leftSection={<IconSearch size={14} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            style={{ width: 160 }}
          />
          <DropdownMenu placement="bottom-end" arrow>
            <DropdownMenu.Target>
              <IconButton
                emphasis={typeFilter ? 'strong' : 'low'}
                size="sm"
                tone="neutral"
                aria-label="Filter works by type"
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
        </Group>
      </Group>
      <Divider mb="md" />
      <Stack gap={0}>
        {filteredWorks.map((work, index) => {
          const imageUrl = work.featured_image_url;
          return (
            <Link
              key={work.id}
              href={`/works/${work.slug || work.id}`}
              className={classes.workRow}
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
                  <Text size="sm" fw={600} c="dimmed">
                    {(work.title || '?').charAt(0).toUpperCase()}
                  </Text>
                )}
              </div>
              <Text size="sm" fw={500} lineClamp={1} style={{ flex: 1 }}>
                {work.title}
              </Text>
              <LabelBadge appearance="soft" size="xs" style={{ flexShrink: 0 }}>
                {getWorkTypeLabel(work.type)}
              </LabelBadge>
            </Link>
          );
        })}
        {filteredWorks.length === 0 && (
          <Text size="sm" c="dimmed" ta="center" py="md">
            {t('empty')}
          </Text>
        )}
      </Stack>
    </Box>
  );
}
