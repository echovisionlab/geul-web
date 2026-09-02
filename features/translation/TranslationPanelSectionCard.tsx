'use client';

import { useState, type ReactNode } from 'react';
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import { Collapse, Group, Stack } from '@mantine/core';
import { Button } from '@/components/core/Button';
import { SectionCard, SectionHeader } from '@/components/core/Section';

interface TranslationPanelSectionCardProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  persistentActions?: ReactNode;
  children: ReactNode;
  expandLabel: string;
  collapseLabel: string;
  defaultExpanded?: boolean;
  collapsible?: boolean;
  toggleId?: string;
}

export function TranslationPanelSectionCard({
  title,
  description,
  actions,
  persistentActions,
  children,
  expandLabel,
  collapseLabel,
  defaultExpanded = false,
  collapsible = true,
  toggleId,
}: TranslationPanelSectionCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isExpanded = collapsible ? expanded : true;

  return (
    <SectionCard>
      <Stack gap="md">
        <SectionHeader
          title={title}
          description={description}
          actions={
            <Group gap="xs">
              {persistentActions}
              {isExpanded ? actions : null}
              {collapsible ? (
                <Button
                  id={toggleId}
                  size="xs"
                  tone={expanded ? 'accent' : 'neutral'}
                  emphasis="medium"
                  rightSection={expanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                  onClick={() => setExpanded((current) => !current)}
                >
                  {expanded ? collapseLabel : expandLabel}
                </Button>
              ) : null}
            </Group>
          }
        />

        {isExpanded ? <Collapse expanded>{children}</Collapse> : null}
      </Stack>
    </SectionCard>
  );
}
