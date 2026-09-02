import type { ReactNode } from 'react';
import Link from 'next/link';
import { IconChevronLeft, IconChevronRight, IconChevronsLeft, IconChevronsRight } from '@tabler/icons-react';
import { Box, Group, Text } from '@mantine/core';
import { IconButton, type ControlEmphasis } from '@/components/core/IconButton';

const PAGINATION_RESERVED_MIN_HEIGHT_PX = 36;

export interface ServerDataTablePaginationLabels {
  firstPage: string;
  previousPage: string;
  page: (page: number) => string;
  nextPage: string;
  lastPage: string;
}

export interface ServerDataTablePaginationViewProps {
  currentPage: number;
  totalPages: number;
  getPageUrl: (page: number) => string;
  labels: ServerDataTablePaginationLabels;
  reserveSpaceWhenHidden?: boolean;
}

interface PaginationActionProps {
  href: string;
  label: string;
  children: ReactNode;
  disabled?: boolean;
  current?: boolean;
  emphasis?: ControlEmphasis;
}

function PaginationAction({
  href,
  label,
  children,
  disabled = false,
  current = false,
  emphasis = 'low',
}: PaginationActionProps) {
  const content = (
    <IconButton
      component="span"
      emphasis={emphasis}
      label={label}
      aria-hidden={disabled ? undefined : true}
      style={disabled ? { cursor: 'default', opacity: 0.5 } : undefined}
    >
      {children}
    </IconButton>
  );

  if (disabled) {
    return (
      <span aria-label={label} aria-current={current ? 'page' : undefined} aria-disabled="true">
        {content}
      </span>
    );
  }

  return (
    <Link
      href={href}
      scroll={false}
      aria-label={label}
      aria-current={current ? 'page' : undefined}
      style={{ textDecoration: 'none' }}
    >
      {content}
    </Link>
  );
}

export function ServerDataTablePaginationView({
  currentPage,
  totalPages,
  getPageUrl,
  labels,
  reserveSpaceWhenHidden = false,
}: ServerDataTablePaginationViewProps) {
  if (totalPages < 1) {
    return reserveSpaceWhenHidden ? (
      <Box
        aria-hidden="true"
        style={{
          marginTop: 'var(--mantine-spacing-md)',
          minHeight: PAGINATION_RESERVED_MIN_HEIGHT_PX,
        }}
      />
    ) : null;
  }

  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, currentPage + 2);
  const pageNumbers = Array.from({ length: endPage - startPage + 1 }, (_, index) => startPage + index);

  return (
    <Group justify="center" mt="md" gap="xs">
      <PaginationAction href={getPageUrl(1)} label={labels.firstPage} disabled={currentPage === 1}>
        <IconChevronsLeft size={16} />
      </PaginationAction>

      <PaginationAction
        href={getPageUrl(Math.max(1, currentPage - 1))}
        label={labels.previousPage}
        disabled={currentPage === 1}
      >
        <IconChevronLeft size={16} />
      </PaginationAction>

      {startPage > 1 && (
        <>
          <PaginationAction href={getPageUrl(1)} label={labels.page(1)}>
            1
          </PaginationAction>
          {startPage > 2 && <Text c="dimmed">...</Text>}
        </>
      )}

      {pageNumbers.map((page) => (
        <PaginationAction
          key={page}
          href={getPageUrl(page)}
          label={labels.page(page)}
          emphasis={page === currentPage ? 'strong' : 'low'}
          current={page === currentPage}
        >
          {page}
        </PaginationAction>
      ))}

      {endPage < totalPages && (
        <>
          {endPage < totalPages - 1 && <Text c="dimmed">...</Text>}
          <PaginationAction href={getPageUrl(totalPages)} label={labels.page(totalPages)}>
            {totalPages}
          </PaginationAction>
        </>
      )}

      <PaginationAction
        href={getPageUrl(Math.min(totalPages, currentPage + 1))}
        label={labels.nextPage}
        disabled={currentPage === totalPages}
      >
        <IconChevronRight size={16} />
      </PaginationAction>

      <PaginationAction href={getPageUrl(totalPages)} label={labels.lastPage} disabled={currentPage === totalPages}>
        <IconChevronsRight size={16} />
      </PaginationAction>
    </Group>
  );
}
