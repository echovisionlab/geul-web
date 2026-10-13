'use client';

import { useId, type CSSProperties, type ReactNode } from 'react';
import { Button as AriaButton, Link as AriaLink } from 'react-aria-components';
import { useNavigationClick } from '../Navigation/navigation-events';
import { useNavigationPrefetch } from '../Navigation/navigation-prefetch';
import { IconChevronRight } from '@tabler/icons-react';
import { DropdownMenu } from '../DropdownMenu';
import { Tooltip } from '../Tooltip';
import classes from './SideNavigation.module.css';
import { useHierarchyStep } from '../Hierarchy';

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
  onToggleSection: (sectionKey: string) => void;
  onSelectItem: (item: SideNavigationItem) => void;
}

function NavigationItem({
  item,
  compact,
  onSelectItem,
}: {
  item: SideNavigationItem;
  compact: boolean;
  onSelectItem: (item: SideNavigationItem) => void;
}) {
  const click = useNavigationClick({ href: item.href }, () => onSelectItem(item));
  const prefetch = useNavigationPrefetch();
  const prepare = () => {
    if (item.prefetch !== false) {
      prefetch?.(item.href);
    }
  };
  return (
    <Tooltip label={item.label} position="right" withArrow openDelay={300} disabled={!compact}>
      <AriaLink
        href={item.href}
        className={classes.item}
        aria-label={compact ? item.label : undefined}
        aria-current={item.active ? 'page' : undefined}
        data-active={item.active || undefined}
        data-item-key={item.key}
        onClick={click}
        onHoverStart={prepare}
        onFocus={prepare}
      >
        <span className={classes.itemIcon} aria-hidden>
          {item.icon}
        </span>
        <span className={classes.itemLabel}>{item.label}</span>
      </AriaLink>
    </Tooltip>
  );
}

export function SideNavigation({
  ariaLabel,
  sections,
  mode,
  showExpandedIcons = true,
  openSectionKeys,
  onToggleSection,
  onSelectItem,
}: SideNavigationProps) {
  const navigationId = useId();
  const hierarchyStep = useHierarchyStep();
  const compact = mode === 'compact';

  return (
    <nav
      aria-label={ariaLabel}
      className={`${classes.root} ${compact ? classes.compact : classes.expanded}`}
      data-mode={mode}
      data-expanded-icons={showExpandedIcons ? 'visible' : 'hidden'}
      data-side-navigation
      style={{ '--_hierarchy-step': hierarchyStep } as CSSProperties}
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
                  <AriaButton
                    type="button"
                    className={`${classes.item} ${classes.compactSectionTrigger}`}
                    aria-label={sectionLabel}
                    data-active={Boolean(activeItem) || undefined}
                    data-compact-section-trigger={section.key}
                  >
                    <span className={classes.itemIcon} aria-hidden>
                      {sectionIcon}
                    </span>
                    <span className={classes.itemLabel}>{sectionLabel}</span>
                  </AriaButton>
                </DropdownMenu.Target>
                <DropdownMenu.Dropdown data-side-navigation-menu={section.key}>
                  <DropdownMenu.Label>{sectionLabel}</DropdownMenu.Label>
                  {section.items.map((item) => (
                    <DropdownMenu.Item
                      key={item.key}
                      href={item.href}
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
            data-section-label={hasLabel || undefined}
          >
            {!compact && hasLabel ? (
              <AriaButton
                id={headerId}
                type="button"
                className={classes.sectionHeader}
                aria-controls={contentId}
                aria-expanded={open}
                onPress={() => onToggleSection(section.key)}
              >
                <span className={classes.sectionLabel}>{sectionLabel}</span>
                <IconChevronRight className={classes.chevron} data-open={open || undefined} aria-hidden />
              </AriaButton>
            ) : null}

            <div id={contentId} className={classes.sectionItems} hidden={!open} data-section-items={section.key}>
              {section.items.map((item) => (
                <NavigationItem key={item.key} item={item} compact={compact} onSelectItem={onSelectItem} />
              ))}
            </div>
          </section>
        );
      })}
    </nav>
  );
}
