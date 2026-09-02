'use client';

import { forwardRef, useId, useMemo, type ComponentPropsWithoutRef, type ElementType, type ReactNode } from 'react';
import { IconChevronRight } from '@tabler/icons-react';
import { DropdownMenu } from '../DropdownMenu';
import { Tooltip } from '../Tooltip';
import classes from './SideNavigation.module.css';

export type SideNavigationMode = 'expanded' | 'compact';

export interface SideNavigationItem {
  key: string;
  href: string;
  label: string;
  icon: ReactNode;
  active?: boolean;
  prefetch?: boolean;
}

export interface SideNavigationSection {
  key: string;
  label?: string;
  icon?: ReactNode;
  items: readonly SideNavigationItem[];
}

export interface SideNavigationProps {
  ariaLabel: string;
  sections: readonly SideNavigationSection[];
  mode: SideNavigationMode;
  showExpandedIcons?: boolean;
  openSectionKeys: readonly string[];
  linkComponent?: ElementType;
  onToggleSection: (sectionKey: string) => void;
  onSelectItem: (item: SideNavigationItem) => void;
}

type NavigationLinkProps = ComponentPropsWithoutRef<'a'> & {
  prefetch?: boolean;
};

export function SideNavigation({
  ariaLabel,
  sections,
  mode,
  showExpandedIcons = true,
  openSectionKeys,
  linkComponent,
  onToggleSection,
  onSelectItem,
}: SideNavigationProps) {
  const navigationId = useId();
  const LinkComponent = linkComponent ?? 'a';
  const CompactLinkComponent = useMemo(() => {
    const CompactLink = forwardRef<HTMLAnchorElement, NavigationLinkProps>((props, ref) => (
      <LinkComponent {...props} ref={ref} />
    ));
    CompactLink.displayName = 'SideNavigationCompactLink';
    return CompactLink;
  }, [LinkComponent]);
  const compact = mode === 'compact';

  return (
    <nav
      aria-label={ariaLabel}
      className={`${classes.root} ${compact ? classes.compact : classes.expanded}`}
      data-mode={mode}
      data-expanded-icons={showExpandedIcons ? 'visible' : 'hidden'}
      data-side-navigation
    >
      {sections.map((section, sectionIndex) => {
        const contentId = `${navigationId}-section-${sectionIndex}`;
        const headerId = `${contentId}-header`;
        const sectionLabel = section.label;
        const hasLabel = Boolean(sectionLabel);
        const open = compact || !hasLabel || openSectionKeys.includes(section.key);
        const activeItem = section.items.find((item) => item.active);
        const sectionIcon = section.icon ?? activeItem?.icon ?? section.items[0]?.icon;

        if (compact && sectionLabel) {
          return (
            <section
              key={section.key}
              className={classes.section}
              aria-label={sectionLabel}
              data-section-key={section.key}
            >
              <DropdownMenu size="wide" placement="right-start">
                <DropdownMenu.Target>
                  <button
                    type="button"
                    className={`${classes.item} ${classes.compactSectionTrigger}`}
                    aria-label={sectionLabel}
                    title={sectionLabel}
                    data-active={Boolean(activeItem) || undefined}
                    data-compact-section-trigger={section.key}
                  >
                    <span className={classes.itemIcon} aria-hidden>
                      {sectionIcon}
                    </span>
                    <span className={classes.itemLabel}>{sectionLabel}</span>
                  </button>
                </DropdownMenu.Target>
                <DropdownMenu.Dropdown
                  className={classes.compactSectionDropdown}
                  data-side-navigation-menu={section.key}
                >
                  <DropdownMenu.Label>{sectionLabel}</DropdownMenu.Label>
                  {section.items.map((item) => (
                    <DropdownMenu.Item
                      key={item.key}
                      component={CompactLinkComponent}
                      href={item.href}
                      prefetch={item.prefetch}
                      icon={item.icon}
                      selected={item.active}
                      aria-current={item.active ? 'page' : undefined}
                      data-item-key={item.key}
                      onClick={() => onSelectItem(item)}
                    >
                      {item.label}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Dropdown>
              </DropdownMenu>
            </section>
          );
        }

        return (
          <section
            key={section.key}
            className={classes.section}
            aria-label={compact ? sectionLabel : undefined}
            aria-labelledby={!compact && hasLabel ? headerId : undefined}
            data-section-key={section.key}
          >
            {!compact && hasLabel ? (
              <button
                id={headerId}
                type="button"
                className={classes.sectionHeader}
                aria-controls={contentId}
                aria-expanded={open}
                onClick={() => onToggleSection(section.key)}
              >
                <span className={classes.sectionLabel}>{sectionLabel}</span>
                <IconChevronRight className={classes.chevron} data-open={open || undefined} aria-hidden />
              </button>
            ) : null}

            <div id={contentId} className={classes.sectionItems} hidden={!open} data-section-items={section.key}>
              {section.items.map((item) => (
                <Tooltip
                  key={item.key}
                  label={item.label}
                  position="right"
                  withArrow
                  openDelay={300}
                  disabled={!compact}
                >
                  <LinkComponent
                    href={item.href}
                    prefetch={item.prefetch}
                    className={classes.item}
                    aria-label={compact ? item.label : undefined}
                    aria-current={item.active ? 'page' : undefined}
                    data-active={item.active || undefined}
                    data-item-key={item.key}
                    onClick={() => onSelectItem(item)}
                  >
                    <span className={classes.itemIcon} aria-hidden>
                      {item.icon}
                    </span>
                    <span className={classes.itemLabel}>{item.label}</span>
                  </LinkComponent>
                </Tooltip>
              ))}
            </div>
          </section>
        );
      })}
    </nav>
  );
}
