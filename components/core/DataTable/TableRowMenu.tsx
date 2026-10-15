'use client';

import { Fragment, type MouseEvent, type ReactNode } from 'react';
import { IconDots } from '@tabler/icons-react';
import { DropdownMenu } from '../DropdownMenu';
import { IconButton } from '../IconButton';
import type { ControlTone } from '../control-style';

export interface TableRowMenuItem {
  /** Display label and aria-label for the menu item */
  label: string;
  icon?: ReactNode;
  /** Click handler - required if href is not provided */
  onClick?: () => void;
  /** Link href - if provided, item will be rendered as a Link */
  href?: string;
  /** Core action tone; `danger` marks the destructive group, separated by a divider. */
  tone?: ControlTone;
  disabled?: boolean;
}

export interface TableRowMenuProps {
  /** Menu items */
  items: TableRowMenuItem[];
  /** Required aria-label for the menu trigger button */
  'aria-label': string;
}

export function TableRowMenu({ items, 'aria-label': ariaLabel }: TableRowMenuProps) {
  if (items.length === 0) {
    return null;
  }

  const stopRowClick = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
  };

  // The first destructive item starts a divided group.
  const destructiveIndex = items.findIndex((item) => item.tone === 'danger');

  return (
    <DropdownMenu>
      <DropdownMenu.Target>
        <IconButton emphasis="low" aria-label={ariaLabel} onMouseDown={stopRowClick} onClick={stopRowClick}>
          <IconDots />
        </IconButton>
      </DropdownMenu.Target>
      <DropdownMenu.Dropdown onMouseDown={stopRowClick} onClick={stopRowClick}>
        {items.map((item, index) => (
          <Fragment key={item.label}>
            {index === destructiveIndex && destructiveIndex > 0 && <DropdownMenu.Divider />}
            {item.href ? (
              <DropdownMenu.Item
                href={item.href}
                icon={item.icon}
                onClick={item.onClick}
                tone={item.tone}
                disabled={item.disabled}
                aria-label={item.label}
              >
                {item.label}
              </DropdownMenu.Item>
            ) : (
              <DropdownMenu.Item
                icon={item.icon}
                onClick={item.onClick}
                tone={item.tone}
                disabled={item.disabled}
                aria-label={item.label}
              >
                {item.label}
              </DropdownMenu.Item>
            )}
          </Fragment>
        ))}
      </DropdownMenu.Dropdown>
    </DropdownMenu>
  );
}
