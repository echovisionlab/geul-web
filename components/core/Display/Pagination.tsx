// No client directive: link mode renders from Server Components and passes only serializable
// props (href strings, labels) to the client Button/IconButton parts.
import type { ReactNode } from 'react';
import { IconChevronLeft, IconChevronRight, IconChevronsLeft, IconChevronsRight } from '@tabler/icons-react';
import { Button } from '../Button/Button';
import { IconButton } from '../IconButton/IconButton';
import { LayoutInline } from '../Layout';
import { nativeProps, type DisplayNativeProps, type DisplaySize } from './display-native-props';
import classes from './Display.module.css';

export interface PaginationLabels {
  previousPage: string;
  nextPage: string;
  page: (page: number) => string;
  /** Adds a first-page control before previous. */
  firstPage?: string;
  /** Adds a last-page control after next. */
  lastPage?: string;
}
interface PaginationBaseProps extends Omit<DisplayNativeProps, 'onChange'> {
  value: number;
  total: number;
  size?: DisplaySize;
  labels: PaginationLabels;
}
/** Button mode: the consumer owns page state. */
export interface PaginationButtonProps extends PaginationBaseProps {
  onChange: (page: number) => void;
  getHref?: never;
  replace?: never;
  scroll?: never;
  prefetch?: never;
  onNavigate?: never;
}
export interface PaginationNavigateEvent {
  page: number;
  href: string;
  preventDefault: () => void;
}
/** Link mode: every reachable page is a URL anchor; the URL owns page state. */
export interface PaginationLinkProps extends PaginationBaseProps {
  getHref: (page: number) => string;
  onChange?: never;
  replace?: boolean;
  /** Defaults to false: a page change replaces the list in place. */
  scroll?: boolean;
  /** Hover/focus prefetch through Core navigation; false disables it. */
  prefetch?: boolean | null;
  /** Ordinary same-origin primary clicks only; modified clicks keep native anchor behavior. */
  onNavigate?: (event: PaginationNavigateEvent) => void;
}
export type PaginationProps = PaginationButtonProps | PaginationLinkProps;

export function Pagination({
  value,
  total,
  labels,
  size = 'sm',
  onChange,
  getHref,
  replace,
  scroll = false,
  prefetch,
  onNavigate,
  ...props
}: PaginationProps) {
  const count = Number.isFinite(total) ? Math.max(1, Math.floor(total)) : 1;
  const current = Number.isFinite(value) ? Math.min(count, Math.max(1, Math.floor(value))) : 1;
  const pages = [
    ...new Set([1, ...Array.from({ length: 5 }, (_, i) => current - 2 + i).filter((p) => p > 1 && p < count), count]),
  ].sort((a, b) => a - b);
  const link =
    getHref &&
    ((page: number) => {
      const href = getHref(page);
      return {
        href,
        replace,
        scroll,
        prefetch,
        onNavigate: onNavigate
          ? (event: { preventDefault: () => void }) =>
              onNavigate({ page, href, preventDefault: () => event.preventDefault() })
          : undefined,
      };
    });
  // Bounds are native disabled buttons without an href in both modes.
  const step = (key: string, label: string | undefined, page: number, disabled: boolean, icon: ReactNode) => {
    if (label === undefined) {
      return null;
    }
    return link === undefined || disabled ? (
      <IconButton
        key={key}
        label={label}
        disabled={disabled}
        onClick={link === undefined ? () => onChange?.(page) : undefined}
        size={size}
      >
        {icon}
      </IconButton>
    ) : (
      <IconButton key={key} label={label} size={size} {...link(page)}>
        {icon}
      </IconButton>
    );
  };
  const pageItem = (page: number) => {
    const shared = {
      size,
      'aria-label': labels.page(page),
      'aria-current': page === current ? ('page' as const) : undefined,
      emphasis: page === current ? ('medium' as const) : ('low' as const),
    };
    return link === undefined ? (
      <Button key={page} {...shared} onClick={() => onChange?.(page)}>
        {page}
      </Button>
    ) : (
      <Button key={page} {...shared} {...link(page)}>
        {page}
      </Button>
    );
  };
  return (
    <nav {...nativeProps(props)} aria-label={props['aria-label'] ?? labels.page(current)}>
      <LayoutInline gap="xxs" wrap="wrap">
        {step('first', labels.firstPage, 1, current === 1, <IconChevronsLeft size="1em" aria-hidden />)}
        {step('previous', labels.previousPage, current - 1, current === 1, <IconChevronLeft size="1em" aria-hidden />)}
        {pages.flatMap((page, i) => [
          i && page - pages[i - 1] > 1 ? (
            <span key={`gap-${page}`} className={classes.paginationGap} aria-hidden>
              …
            </span>
          ) : null,
          pageItem(page),
        ])}
        {step('next', labels.nextPage, current + 1, current === count, <IconChevronRight size="1em" aria-hidden />)}
        {step('last', labels.lastPage, count, current === count, <IconChevronsRight size="1em" aria-hidden />)}
      </LayoutInline>
    </nav>
  );
}
