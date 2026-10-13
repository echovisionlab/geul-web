'use client';

import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { Header, ListBox, ListBoxItem, ListBoxSection, Text } from 'react-aria-components';
import type { ClosedVisualProps } from '../visual-contract';
import classes from './CommandSuggestions.module.css';

export interface CommandSuggestion {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  group?: string;
  disabled?: boolean;
  testId?: string;
}
export interface CommandSuggestionsProps extends ClosedVisualProps {
  id: string;
  label: string;
  density?: 'compact' | 'comfortable';
  showGroupLabels?: boolean;
  items: readonly CommandSuggestion[];
  activeId?: string;
  onSelect: (id: string) => void;
  inputElement: HTMLElement;
  position: { left: number; top: number };
  'data-testid'?: string;
}
/** Compact command results with external virtual focus: the host keeps the typing caret. */
export function CommandSuggestions({
  id,
  label,
  density = 'comfortable',
  items,
  showGroupLabels = true,
  activeId,
  onSelect,
  inputElement,
  position,
  'data-testid': testId,
}: CommandSuggestionsProps) {
  const ref = useRef<HTMLDivElement>(null);
  const groups: { id: string; label: string; items: CommandSuggestion[] }[] = [];
  for (const item of items) {
    const group = item.group ?? '';
    const previous = groups.at(-1);
    if (previous?.label === group) {
      previous.items.push(item);
    } else {
      groups.push({ id: item.id, label: group, items: [item] });
    }
  }
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    let ownedActive: string | undefined;
    const connect = () => {
      inputElement.setAttribute('aria-controls', id);
      const active = element.querySelector<HTMLElement>('[aria-selected="true"]');
      if (!active) {
        inputElement.removeAttribute('aria-activedescendant');
        return;
      }
      ownedActive = active.id;
      inputElement.setAttribute('aria-activedescendant', active.id);
      active.scrollIntoView?.({ block: 'nearest' });
    };
    connect();
    // RAC collections commit their option DOM after the host layout effect.
    const observer = new MutationObserver(connect);
    observer.observe(element, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-selected'] });
    return () => {
      observer.disconnect();
      if (inputElement.getAttribute('aria-controls') === id) {
        inputElement.removeAttribute('aria-controls');
      }
      if (inputElement.getAttribute('aria-activedescendant') === ownedActive) {
        inputElement.removeAttribute('aria-activedescendant');
      }
    };
  }, [id, activeId, inputElement, items]);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const fit = () => {
      element.style.top = `${position.top}px`;
      const rect = element.getBoundingClientRect();
      const viewport = element.ownerDocument.defaultView?.innerHeight ?? 0;
      const caretHeight =
        parseFloat(getComputedStyle(inputElement).lineHeight) ||
        parseFloat(getComputedStyle(inputElement).fontSize) ||
        0;
      const above = rect.top - rect.height - caretHeight;
      if (viewport && rect.bottom > viewport && above >= 0) {
        element.style.top = `${position.top - rect.height - caretHeight}px`;
      }
    };
    fit();
    const collectionObserver = new MutationObserver(fit);
    collectionObserver.observe(element, { childList: true, subtree: true });
    const sizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : undefined;
    sizeObserver?.observe(element);
    window.addEventListener('resize', fit);
    window.addEventListener('scroll', fit, true);
    return () => {
      collectionObserver.disconnect();
      sizeObserver?.disconnect();
      window.removeEventListener('resize', fit);
      window.removeEventListener('scroll', fit, true);
    };
  }, [position.left, position.top, items, inputElement]);
  return (
    <div
      ref={ref}
      className={classes.results}
      data-geul-command-density={density}
      style={{ '--_command-left': `${position.left}px`, top: position.top } as CSSProperties}
    >
      <ListBox
        id={id}
        aria-label={label}
        className={classes.list}
        data-testid={testId}
        selectionMode="single"
        selectionBehavior="replace"
        selectedKeys={activeId ? [activeId] : []}
        disabledKeys={items.filter((item) => item.disabled).map((item) => item.id)}
        onAction={(key) => onSelect(String(key))}
        onMouseDown={(event) => event.preventDefault()}
      >
        {groups.map((group) => (
          <ListBoxSection key={group.id}>
            {showGroupLabels && group.label ? <Header className={classes.group}>{group.label}</Header> : null}
            {group.items.map((item) => (
              <ListBoxItem
                id={item.id}
                key={item.id}
                textValue={item.label}
                aria-label={item.label}
                data-testid={item.testId}
                className={classes.item}
              >
                {item.icon ? (
                  <span className={classes.icon} aria-hidden>
                    {item.icon}
                  </span>
                ) : null}
                <span className={classes.copy}>
                  <Text slot="label" className={classes.label}>
                    {item.label}
                  </Text>
                  {item.description ? (
                    <Text slot="description" className={classes.description}>
                      {item.description}
                    </Text>
                  ) : null}
                </span>
              </ListBoxItem>
            ))}
          </ListBoxSection>
        ))}
      </ListBox>
      {density === 'compact' && items.find((item) => item.id === activeId)?.description ? (
        <div className={classes.detail} aria-hidden>
          {items.find((item) => item.id === activeId)?.description}
        </div>
      ) : null}
    </div>
  );
}
