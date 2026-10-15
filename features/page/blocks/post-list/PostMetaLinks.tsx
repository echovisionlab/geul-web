import { Fragment } from 'react';
import { NavigationLink, type LinkProps } from '@/components/core/Navigation';
import { LayoutInline, LayoutInset } from '@/components/core/Layout';
import { Text, type TextTone } from '@/components/core/Typography';

export interface PostMetaLinkItem {
  id: string;
  label: string;
  href?: string | null;
}
interface PostMetaLinksProps {
  items: PostMetaLinkItem[];
  textSize?: 'xs' | 'sm';
  tone?: LinkProps['tone'];
  separatorTone?: TextTone;
}
export function PostMetaLinks({
  items,
  textSize = 'xs',
  tone = 'inherit',
  separatorTone = 'secondary',
}: PostMetaLinksProps) {
  if (items.length === 0) {
    return null;
  }
  return (
    <LayoutInline gap="none" align="center" wrap="wrap">
      {items.map((item, index) => (
        <Fragment key={item.id}>
          {index > 0 ? (
            <LayoutInset inline="xxs">
              <Text as="span" size={textSize} tone={separatorTone}>
                /
              </Text>
            </LayoutInset>
          ) : null}
          {item.href ? (
            <NavigationLink href={item.href} appearance="quiet" size={textSize} tone={tone}>
              {item.label}
            </NavigationLink>
          ) : (
            <Text as="span" size={textSize} tone={tone === 'inherit' ? 'primary' : tone}>
              {item.label}
            </Text>
          )}
        </Fragment>
      ))}
    </LayoutInline>
  );
}
