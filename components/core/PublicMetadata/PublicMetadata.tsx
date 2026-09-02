import type { ReactNode } from 'react';
import Link from 'next/link';
import { Group, Stack, Text, type TextProps } from '@mantine/core';
import classes from './PublicMetadata.module.css';

export interface PublicMetadataRowsProps {
  children: ReactNode;
  className?: string;
  tone?: 'default' | 'inverse';
}

export interface PublicMetadataRowProps {
  label: ReactNode;
  children: ReactNode;
  labelColor?: TextProps['c'];
  labelSize?: TextProps['size'];
  valueAlign?: 'baseline' | 'center';
}

export interface PublicMetadataValueGroupProps {
  children: ReactNode;
}

export interface PublicMetadataLinkProps {
  href: string;
  children: ReactNode;
  external?: boolean;
  ariaLabel?: string;
}

export function PublicMetadataRows({ children, className, tone = 'default' }: PublicMetadataRowsProps) {
  return (
    <Stack gap={8} className={[classes.rows, className].filter(Boolean).join(' ')} data-tone={tone}>
      {children}
    </Stack>
  );
}

export function PublicMetadataRow({
  label,
  children,
  labelColor = 'dimmed',
  labelSize = 'sm',
  valueAlign = 'baseline',
}: PublicMetadataRowProps) {
  return (
    <div className={classes.row}>
      <Text size={labelSize} c={labelColor} fw={500} className={classes.label}>
        {label}
      </Text>
      <div className={classes.value} data-align={valueAlign}>
        {children}
      </div>
    </div>
  );
}

export function PublicMetadataValueGroup({ children }: PublicMetadataValueGroupProps) {
  return (
    <Group gap={4} wrap="wrap" align="baseline" className={classes.valueGroup}>
      {children}
    </Group>
  );
}

export function PublicMetadataLink({ href, children, external = false, ariaLabel }: PublicMetadataLinkProps) {
  const props = {
    className: classes.link,
    'aria-label': ariaLabel,
  };

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} {...props}>
      {children}
    </Link>
  );
}
