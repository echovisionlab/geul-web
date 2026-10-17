import type { ReactNode } from 'react';
import { LayoutStack } from '@/components/core/Layout';
import { SectionCard, SectionHeader } from '@/components/core/Section';

/**
 * One card of a document's settings column. Every editor composes its settings from these (or from
 * section components that render the same card) in one order: URL, details, classification and
 * related records, options, summary, images, metadata, sharing, translations.
 */
export function EditorSettingsSection({
  title,
  description,
  actions,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <SectionCard padding={{ base: 'none', sm: 'md' }}>
      <LayoutStack gap="md">
        <SectionHeader title={title} description={description} actions={actions} />
        {children}
      </LayoutStack>
    </SectionCard>
  );
}
