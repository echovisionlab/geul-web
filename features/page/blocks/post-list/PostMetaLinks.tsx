import { Fragment, type CSSProperties } from 'react';
import Link from 'next/link';
import { Anchor, Group, Text } from '@mantine/core';
import classes from './PostAuthorLinks.module.css';

export interface PostMetaLinkItem {
  id: string;
  label: string;
  href?: string | null;
}

interface PostMetaLinksProps {
  items: PostMetaLinkItem[];
  textSize?: 'xs' | 'sm';
  textColor?: string;
  separatorColor?: string;
}

export function PostMetaLinks({ items, textSize = 'xs', textColor, separatorColor }: PostMetaLinksProps) {
  if (items.length === 0) {
    return null;
  }

  const linkStyle = textColor ? ({ '--post-meta-link-color': textColor } as CSSProperties) : undefined;
  const separatorStyle = separatorColor ? ({ color: separatorColor } as CSSProperties) : undefined;

  return (
    <Group gap={3} wrap="wrap" className={classes.metaLinkList}>
      {items.map((item, index) => (
        <Fragment key={item.id}>
          {index > 0 ? (
            <Text component="span" size={textSize} className={classes.metaSeparator} style={separatorStyle}>
              /
            </Text>
          ) : null}
          {item.href ? (
            <Anchor component={Link} href={item.href} size={textSize} className={classes.metaLink} style={linkStyle}>
              {item.label}
            </Anchor>
          ) : (
            <Anchor component="span" size={textSize} className={classes.metaLink} style={linkStyle}>
              {item.label}
            </Anchor>
          )}
        </Fragment>
      ))}
    </Group>
  );
}
