'use client';

import type { OverlayPresentationProps } from '../overlay-contract';

import { createElement, forwardRef, type CSSProperties, type ReactNode } from 'react';
import { Button, Disclosure as AriaDisclosure, DisclosurePanel } from 'react-aria-components';
import { IconChevronDown } from '@tabler/icons-react';
import classes from './Disclosure.module.css';
import { ToolbarDensityProvider } from '../control-context';
import { useHierarchyStep } from '../Hierarchy';

export type DisclosureAppearance = 'plain' | 'filled';
export type DisclosureDensity = 'standard' | 'compact';
export type DisclosureShape = 'square';
export type DisclosureContentIndent = 'label' | 'none' | 'small';
export type DisclosureChevronPosition = 'start' | 'end';
export interface DisclosureProps extends OverlayPresentationProps {
  label: ReactNode;
  leadingActions?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  opened?: boolean;
  defaultOpened?: boolean;
  onChange?: (opened: boolean) => void;
  appearance?: DisclosureAppearance;
  density?: DisclosureDensity;
  shape?: DisclosureShape;
  contentIndent?: DisclosureContentIndent;
  /** A child in a parent's label-aligned body; leading action tracks remain authoritative. */
  nested?: boolean;
  chevronPosition?: DisclosureChevronPosition;
  withDivider?: boolean;
  disabled?: boolean;
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  keepMounted?: boolean;
  id?: string;
}
export const Disclosure = forwardRef<HTMLDivElement, DisclosureProps>(
  (
    {
      label,
      leadingActions,
      actions,
      children,
      opened,
      defaultOpened = false,
      onChange,
      appearance = 'plain',
      density = 'standard',
      shape = 'square',
      contentIndent = 'label',
      nested = false,
      chevronPosition = 'end',
      withDivider = true,
      disabled = false,
      headingLevel,
      keepMounted = true,
      id,
    },
    ref,
  ) => {
    const hierarchyStep = useHierarchyStep();
    return (
      <AriaDisclosure
        ref={ref}
        id={id}
        isExpanded={opened}
        defaultExpanded={defaultOpened}
        onExpandedChange={onChange}
        isDisabled={disabled}
        className={classes.root}
        data-appearance={appearance}
        data-density={density}
        data-shape={shape}
        data-content-indent={contentIndent}
        data-geul-hierarchy-nested={nested || undefined}
        style={{ '--_hierarchy-step': hierarchyStep } as CSSProperties}
        data-chevron-position={chevronPosition}
        data-leading-actions={leadingActions ? true : undefined}
        data-actions={actions ? true : undefined}
        data-divider={withDivider ? 'line' : 'none'}
        data-disclosure
      >
        {({ isExpanded }) => (
          <>
            <div className={classes.header}>
              {leadingActions ? (
                <div className={classes.leadingActions}>
                  <ToolbarDensityProvider density={density === 'compact' ? 'compact' : 'comfortable'}>
                    {leadingActions}
                  </ToolbarDensityProvider>
                </div>
              ) : null}
              {createElement(
                headingLevel ? `h${headingLevel}` : 'div',
                { className: classes.heading },
                <Button slot="trigger" className={classes.control} data-accordion-control>
                  {chevronPosition === 'start' ? (
                    <span className={classes.chevronSlot} aria-hidden>
                      <IconChevronDown size="1em" className={classes.chevron} />
                    </span>
                  ) : null}
                  <span className={classes.label}>{label}</span>
                  {chevronPosition === 'end' ? (
                    <span className={classes.chevronSlot} aria-hidden>
                      <IconChevronDown size="1em" className={classes.chevron} />
                    </span>
                  ) : null}
                </Button>,
              )}
              {actions ? (
                <div className={classes.actions}>
                  <ToolbarDensityProvider density={density === 'compact' ? 'compact' : 'comfortable'}>
                    {actions}
                  </ToolbarDensityProvider>
                </div>
              ) : null}
            </div>
            {keepMounted || isExpanded ? (
              <DisclosurePanel className={classes.content}>{children}</DisclosurePanel>
            ) : null}
          </>
        )}
      </AriaDisclosure>
    );
  },
);
Disclosure.displayName = 'Disclosure';

/** Controlled expansion for consumers that already own an accessible trigger. */
export type DisclosureRegionProps = OverlayPresentationProps & {
  'data-geul-disclosure-region'?: never;
  expanded: boolean;
  children?: ReactNode;
  id?: string;
  labelledBy?: string;
  keepMounted?: boolean;
};
export const DisclosureRegion = forwardRef<HTMLDivElement, DisclosureRegionProps>(
  ({ expanded, children, id, labelledBy, keepMounted = true }, ref) => {
    if (!expanded && !keepMounted) {
      return null;
    }
    return (
      <div
        ref={ref}
        id={id}
        aria-labelledby={labelledBy}
        role={labelledBy ? 'region' : undefined}
        hidden={!expanded}
        data-geul-disclosure-region
        data-expanded={expanded || undefined}
        className={classes.region}
      >
        {children}
      </div>
    );
  },
);
DisclosureRegion.displayName = 'DisclosureRegion';
