'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { useDrawerDesktop } from '../Drawer/drawer-visibility';
import classes from './ApplicationFrame.module.css';

export interface SiteNavigationPanelProps {
  id?: string;
  opened: boolean;
  onClose: () => void;
  label: string;
  children?: ReactNode;
}

/**
 * Phone site navigation: a disclosure panel that fills the screen below the header. The header stays
 * in place, so the brand does not move and the MenuToggle that opened the panel (now a close glyph)
 * closes it. While open, the page behind is inert and does not scroll; Escape closes and returns
 * focus to the toggle; widening to the desktop layout closes it.
 */
export function SiteNavigationPanel({ id, opened, onClose, label, children }: SiteNavigationPanelProps) {
  const desktop = useDrawerDesktop();
  const visible = opened && !desktop;
  const panel = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (opened && desktop) {
      onCloseRef.current();
    }
  }, [opened, desktop]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    const root = document.documentElement;
    const frame = panel.current?.parentElement;
    const behind = frame ? Array.from(frame.querySelectorAll<HTMLElement>(':scope > main, :scope > footer')) : [];
    root.setAttribute('data-site-navigation-open', '');
    for (const element of behind) {
      element.setAttribute('inert', '');
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) {
        return;
      }
      onCloseRef.current();
      if (id) {
        document.querySelector<HTMLElement>(`[aria-controls="${CSS.escape(id)}"]`)?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      root.removeAttribute('data-site-navigation-open');
      for (const element of behind) {
        element.removeAttribute('inert');
      }
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [visible, id]);

  return (
    <nav
      ref={panel}
      id={id}
      aria-label={label}
      className={classes.siteNavigation}
      hidden={!visible}
      data-site-navigation
    >
      {children}
    </nav>
  );
}
