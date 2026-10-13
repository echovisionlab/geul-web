'use client';

import { LayoutStack as DsLayoutStack, LayoutInline as DsLayoutInline } from '@/components/core/Layout';
import { useId, useState, type ReactNode } from 'react';
import { DisclosureRegion } from '@/components/core/Disclosure';
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
  const panelId = useId();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isExpanded = collapsible ? expanded : true;

  return (
    <SectionCard padding={{ base: 'none', sm: 'md' }}>
      <DsLayoutStack gap="md">
        <SectionHeader
          descriptionPlacement="below-row"
          title={title}
          description={description}
          actions={
            <DsLayoutInline gap="xs">
              {persistentActions}
              {isExpanded ? actions : null}
              {collapsible ? (
                <Button
                  id={toggleId}
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  size="xs"
                  tone="neutral"
                  emphasis="medium"
                  indicator="disclosure"
                  onClick={() => setExpanded((current) => !current)}
                >
                  {expanded ? collapseLabel : expandLabel}
                </Button>
              ) : null}
            </DsLayoutInline>
          }
        />

        <DisclosureRegion id={panelId} expanded={isExpanded} keepMounted={false}>
          {children}
        </DisclosureRegion>
      </DsLayoutStack>
    </SectionCard>
  );
}
