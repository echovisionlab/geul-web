'use client';

import type { MouseEvent, ReactNode } from 'react';
import Link from 'next/link';
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
  color?: string;
  disabled?: boolean;
}

export interface TableRowMenuProps {
  /** Menu items */
  items: TableRowMenuItem[];
  /** Required aria-label for the menu trigger button */
  'aria-label': string;
}

function resolveItemTone(color: string | undefined): ControlTone | undefined {
  switch (color) {
    case 'red':
      return 'danger';
    case 'orange':
    case 'yellow':
      return 'warning';
    case 'green':
    case 'teal':
      return 'positive';
    case 'blue':
      return 'accent';
    case 'gray':
      return 'neutral';
    default:
      return undefined;
  }
}

export function TableRowMenu({ items, 'aria-label': ariaLabel }: TableRowMenuProps) {
  if (items.length === 0) {
    return null;
  }

  const stopRowClick = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
  };

  // Find index of first destructive item (red color) for divider
  const destructiveIndex = items.findIndex((item) => item.color === 'red');

  return (
    <DropdownMenu>
      <DropdownMenu.Target>
        <IconButton emphasis="low" aria-label={ariaLabel} onMouseDown={stopRowClick} onClick={stopRowClick}>
          <IconDots size={16} />
        </IconButton>
      </DropdownMenu.Target>
      <DropdownMenu.Dropdown onMouseDown={stopRowClick} onClick={stopRowClick}>
        {items.map((item, index) => (
          <div key={item.label}>
            {index === destructiveIndex && destructiveIndex > 0 && <DropdownMenu.Divider />}
            {item.href ? (
              <DropdownMenu.Item
                component={Link}
                href={item.href}
                icon={item.icon}
                onClick={(event) => {
                  stopRowClick(event);
                  item.onClick?.();
                }}
                tone={resolveItemTone(item.color)}
                disabled={item.disabled}
                aria-label={item.label}
              >
                {item.label}
              </DropdownMenu.Item>
            ) : (
              <DropdownMenu.Item
                icon={item.icon}
                onClick={(event) => {
                  stopRowClick(event);
                  item.onClick?.();
                }}
                tone={resolveItemTone(item.color)}
                disabled={item.disabled}
                aria-label={item.label}
              >
                {item.label}
              </DropdownMenu.Item>
            )}
          </div>
        ))}
      </DropdownMenu.Dropdown>
    </DropdownMenu>
  );
}
