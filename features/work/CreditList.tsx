'use client';

import { HierarchyIndent } from '@/components/core/Hierarchy';
import { LayoutInline as DsLayoutInline, LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { Avatar } from '@/components/core/Display';
import { useTranslations } from 'next-intl';
import { NavigationLink as Anchor } from '@/components/core/Navigation';
/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */
interface CreditListItemProps {
  name: string;
  role?: string | null;
  note?: string | null;
  href?: string | null;
  imageUrl?: string | null;
}
interface CreditListGroupProps {
  name: string;
  children: React.ReactNode;
}
interface CreditListRootProps {
  title?: string;
  children: React.ReactNode;
}
/* -------------------------------------------------------------------------- */
/*                              CreditList.Item                               */
/* -------------------------------------------------------------------------- */
function CreditListItem({ name, role, note, href, imageUrl }: CreditListItemProps) {
  const nameElement = href ? <Anchor href={href}>{name}</Anchor> : name;
  return (
    <DsLayoutInline gap="xs" role="listitem">
      <Avatar src={imageUrl} alt={name} size="sm" shape="circle" name={name} />
      <DsLayoutStack gap="none">
        <DsText size="sm">
          {nameElement}
          {role && (
            <DsText as="span" tone="secondary">
              {' '}
              — {role}
            </DsText>
          )}
        </DsText>
        {note ? (
          <DsText size="xs" tone="secondary">
            {note}
          </DsText>
        ) : null}
      </DsLayoutStack>
    </DsLayoutInline>
  );
}
/* -------------------------------------------------------------------------- */
/*                              CreditList.Group                              */
/* -------------------------------------------------------------------------- */
function CreditListGroup({ name, children }: CreditListGroupProps) {
  const t = useTranslations('creditList');
  return (
    <DsLayoutStack gap="xxs">
      <DsText size="sm" tone="secondary" weight="medium">
        {name}
      </DsText>
      <HierarchyIndent>
        <DsLayoutStack gap="xxs" role="list" aria-label={t('groupAriaLabel', { name })}>
          {children}
        </DsLayoutStack>
      </HierarchyIndent>
    </DsLayoutStack>
  );
}
/* -------------------------------------------------------------------------- */
/*                               CreditList Root                              */
/* -------------------------------------------------------------------------- */
function CreditListRoot({ title, children }: CreditListRootProps) {
  const tCommon = useTranslations('common');
  return (
    <DsLayoutStack gap="sm">
      <DsText size="sm" weight="medium">
        {title || tCommon('entities.credits')}
      </DsText>
      <DsLayoutStack gap="sm">{children}</DsLayoutStack>
    </DsLayoutStack>
  );
}
/* -------------------------------------------------------------------------- */
/*                                  Export                                    */
/* -------------------------------------------------------------------------- */
export const CreditList = Object.assign(CreditListRoot, {
  Group: CreditListGroup,
  Item: CreditListItem,
});
