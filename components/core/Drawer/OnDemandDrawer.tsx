'use client';
import { forwardRef, useEffect, useRef } from 'react';
import { onDemandModule, useOnDemandModule } from '../on-demand-module';
import type { DrawerProps } from './Drawer';
import { useDrawerDesktop } from './drawer-visibility';

const drawer = onDemandModule(() => import('./Drawer'));

/** Starts loading the drawer surface (React Aria modal, dialog, focus scope). */
export const preloadDrawer = drawer.preload;

/**
 * `Drawer` with the same props and behaviour for always-present chrome. A closed drawer renders
 * nothing, so nothing is loaded until it first opens (or `preloadDrawer()` runs on trigger
 * hover/focus); it then opens as soon as the surface arrives. The trigger keeps focus meanwhile,
 * so closing restores focus to it. Escape before the surface arrives dismisses a dismissible
 * drawer, as it would once open. A `mobile-only` drawer does not load on desktop.
 */
export const OnDemandDrawer = forwardRef<HTMLDivElement, DrawerProps>((props, ref) => {
  const desktop = useDrawerDesktop();
  const visible = props.opened && (props.visibility !== 'mobile-only' || !desktop);
  const loaded = useOnDemandModule(drawer, visible);
  const onCloseRef = useRef(props.onClose);
  onCloseRef.current = props.onClose;
  const dismissible = (props.closePolicy ?? 'dismissible') === 'dismissible' && !props.loading;
  const pending = visible && !loaded && dismissible;
  useEffect(() => {
    if (!pending) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !drawer.peek()) {
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [pending]);
  return loaded ? <loaded.Drawer ref={ref} {...props} /> : null;
});
OnDemandDrawer.displayName = 'OnDemandDrawer';
