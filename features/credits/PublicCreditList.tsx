'use client';

import { Fragment, useId } from 'react';
import { PublicMetadataLink } from '@/components/core/PublicMetadata';
import { Text } from '@/components/core/Typography';
import classes from './PublicCreditList.module.css';

export interface PublicCreditEntry {
  id: string;
  /** Entries without a public name are omitted rather than shown as "Unknown". */
  name: string | null;
  role?: string | null;
  note?: string | null;
  href?: string | null;
}

export interface PublicCreditGroup {
  id: string;
  /** Shown above the group's rows when the list has more than one group. */
  name?: string | null;
  entries: PublicCreditEntry[];
}

export interface PublicCreditListProps {
  groups: PublicCreditGroup[];
  /** Accessible name of each group's list when the group has no visible name. */
  label: string;
}

interface CreditRow {
  role: string | null;
  people: (PublicCreditEntry & { name: string })[];
}

function toRows(entries: PublicCreditEntry[]): CreditRow[] {
  const rows = new Map<string, CreditRow>();
  for (const entry of entries) {
    const name = entry.name?.trim();
    if (!name) {
      continue;
    }
    const role = entry.role?.trim() || null;
    const key = role?.toLowerCase() ?? '';
    const row = rows.get(key) ?? { role, people: [] };
    row.people.push({ ...entry, name });
    rows.set(key, row);
  }
  return Array.from(rows.values());
}

export function hasPublicCredits(groups: PublicCreditGroup[]): boolean {
  return groups.some((group) => toRows(group.entries).length > 0);
}

/**
 * Credits in the public metadata grammar: the role reads as a label, the people as its value, and
 * people who share a role share one row. Used as the value of a metadata row, never as a section.
 */
export function PublicCreditList({ groups, label }: PublicCreditListProps) {
  const baseId = useId();
  const visible = groups
    .map((group) => ({ ...group, rows: toRows(group.entries) }))
    .filter((group) => group.rows.length > 0);
  const showGroupNames = visible.length > 1;

  return (
    <div className={classes.list}>
      {visible.map((group, groupIndex) => {
        const headingId = `${baseId}-${groupIndex}`;
        const heading = showGroupNames && group.name?.trim() ? group.name.trim() : null;
        const roleless = group.rows.every((row) => !row.role);
        return (
          <div key={group.id} className={classes.group}>
            {heading ? (
              <span id={headingId} className={classes.groupName}>
                <Text as="span" size="sm" weight="medium" font="mono">
                  {heading}
                </Text>
              </span>
            ) : null}
            <div
              className={classes.rows}
              role="list"
              aria-labelledby={heading ? headingId : undefined}
              aria-label={heading ? undefined : label}
            >
              {group.rows.map((row) => (
                <div
                  key={row.role ?? ''}
                  className={classes.row}
                  role="listitem"
                  data-roleless={roleless ? '' : undefined}
                >
                  {roleless ? null : (
                    <Text as="span" size="sm" tone="secondary">
                      {row.role}
                    </Text>
                  )}
                  <span className={classes.people}>
                    {row.people.map((person, index) => (
                      <Fragment key={person.id}>
                        {index > 0 ? ', ' : null}
                        {person.href ? (
                          <PublicMetadataLink href={person.href}>{person.name}</PublicMetadataLink>
                        ) : (
                          person.name
                        )}
                        {person.note ? (
                          <Text as="span" size="sm" tone="secondary">
                            {' '}
                            ({person.note})
                          </Text>
                        ) : null}
                      </Fragment>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
