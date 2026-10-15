'use client';
import type { ClosedVisualProps } from '../visual-contract';

import { Children, cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';
import classes from './Field.module.css';
export interface FieldProps extends ClosedVisualProps {
  layout?: 'stack' | 'inline';
  label: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  required?: boolean;
  htmlFor?: string;
}
export function Field({
  label,
  description,
  actions,
  error,
  children,
  required = false,
  htmlFor,
  layout = 'stack',
}: FieldProps) {
  if (layout !== 'stack' && layout !== 'inline') {
    throw new RangeError('Field layout must be stack or inline');
  }
  const uid = useId();
  const onlyChild = Children.count(children) === 1 ? Children.only(children) : null;
  const childProps = isValidElement(onlyChild) ? (onlyChild.props as Record<string, unknown>) : {};
  const childId = htmlFor ?? (typeof childProps.id === 'string' ? childProps.id : uid);
  const descriptionId = description ? `${childId}-description` : undefined;
  const errorId = error ? `${childId}-error` : undefined;
  const describedBy =
    [
      ...new Set(
        [
          typeof childProps['aria-describedby'] === 'string' ? childProps['aria-describedby'] : '',
          descriptionId,
          errorId,
        ]
          .filter(Boolean)
          .flatMap((value) => value?.split(/\s+/) ?? []),
      ),
    ].join(' ') || undefined;
  const resolved = isValidElement(onlyChild)
    ? cloneElement(onlyChild as ReactElement<Record<string, unknown>>, {
        id: childId,
        ...(required ? { required: true } : {}),
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : childProps['aria-invalid'],
        ...(typeof onlyChild.type !== 'string' ? { error: error ? true : childProps.error } : {}),
      })
    : children;
  return (
    <div className={classes.root} data-geul-field-layout={layout}>
      <div className={classes.header}>
        <div className={classes.copy}>
          {/* A field label keeps native label activation. Editable targets need
              focus delegation, without creating another keyboard stop. */}
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
          <label
            className={classes.label}
            htmlFor={childId}
            onClick={() => {
              const target = document.getElementById(childId);
              if (
                target?.matches('[contenteditable="true"]') &&
                target.getAttribute('aria-disabled') !== 'true' &&
                !target.hasAttribute('disabled')
              ) {
                target.focus();
              }
            }}
          >
            {label}
            {required ? (
              <span className={classes.required} aria-hidden>
                {' '}
                *
              </span>
            ) : null}
          </label>
          {description && layout === 'stack' ? (
            <div className={classes.description} id={descriptionId}>
              {description}
            </div>
          ) : null}
        </div>
        {actions}
      </div>
      <div className={classes.control}>{resolved}</div>
      {description && layout === 'inline' ? (
        <div className={classes.description} id={descriptionId}>
          {description}
        </div>
      ) : null}
      {error ? (
        <div className={classes.error} id={errorId}>
          {error}
        </div>
      ) : null}
    </div>
  );
}
