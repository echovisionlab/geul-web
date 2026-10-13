'use client';

import { Children, Fragment, isValidElement, useId, type ReactNode } from 'react';
import { IconExternalLink } from '@tabler/icons-react';
import Link from '../Navigation';
import { LayoutInline } from '../Layout';
import { Text, type TextProps } from '../Typography';
import classes from './PublicMetadata.module.css';
import { MetadataSizeContext, useMetadataTextSize, type MetadataTextSize } from './MetadataPair';
import type { ClosedVisualProps } from '../visual-contract';

export interface PublicMetadataRowsProps extends ClosedVisualProps {
  children: ReactNode;
  tone?: 'default' | 'inverse';
}

export interface PublicMetadataRowProps extends ClosedVisualProps {
  label: ReactNode;
  children: ReactNode;
  labelColor?: TextProps['tone'];
  size?: MetadataTextSize;
  labelSize?: never;
  valueAlign?: 'baseline' | 'center';
}

export interface PublicMetadataValueGroupProps extends ClosedVisualProps {
  children: ReactNode;
  /**
   * Visible boundary between multi-word values (categories, tags, credits). `slash` matches the
   * shared author-list grammar; the glyph is presentational and hidden from assistive technology.
   */
  separator?: 'none' | 'slash';
}

export interface PublicMetadataLinkProps extends ClosedVisualProps {
  href: string;
  children: ReactNode;
  external?: boolean;
  /** Trailing new-context glyph for a visible address. Core owns its size and spacing. */
  indicator?: 'external';
  ariaLabel?: string;
}

export function PublicMetadataRows({ children, tone = 'default' }: PublicMetadataRowsProps) {
  return (
    <div className={classes.rows} data-tone={tone}>
      {children}
    </div>
  );
}

export function PublicMetadataRow({
  label,
  children,
  labelColor,
  size = 'sm',
  valueAlign = 'baseline',
}: PublicMetadataRowProps) {
  const labelId = useId();
  return (
    <MetadataSizeContext.Provider value={size}>
      <div className={`${classes.row} ${classes.pair}`} data-size={size}>
        <div id={labelId} role="term" className={classes.label} data-align={valueAlign}>
          <Text size={size} tone={labelColor ?? 'inherit'} weight="medium" font="mono">
            {label}
          </Text>
        </div>
        <div role="definition" aria-labelledby={labelId} className={classes.value} data-align={valueAlign}>
          {children}
        </div>
      </div>
    </MetadataSizeContext.Provider>
  );
}

export function PublicMetadataValueGroup({ children, separator = 'none' }: PublicMetadataValueGroupProps) {
  return (
    <LayoutInline gap="xxs" wrap="wrap" align="baseline">
      {separator === 'none'
        ? children
        : Children.toArray(children).map((item, index) => (
            <Fragment key={isValidElement(item) && item.key !== null ? item.key : index}>
              {index > 0 ? (
                <span className={classes.separator} aria-hidden="true">
                  /
                </span>
              ) : null}
              {item}
            </Fragment>
          ))}
    </LayoutInline>
  );
}

export function PublicMetadataLink({
  href,
  children,
  external = false,
  indicator,
  ariaLabel,
}: PublicMetadataLinkProps) {
  const size = useMetadataTextSize();
  return (
    <Link
      href={href}
      appearance="quiet"
      size={size}
      tone="inherit"
      aria-label={ariaLabel}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
    >
      {children}
      {indicator === 'external' ? <IconExternalLink className={classes.externalIndicator} aria-hidden /> : null}
    </Link>
  );
}
