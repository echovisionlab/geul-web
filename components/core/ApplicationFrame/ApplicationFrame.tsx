'use client';
import type { ReactNode } from 'react';
import { Button as AriaButton } from 'react-aria-components';
import { OnDemandDrawer, preloadDrawer } from '../Drawer/OnDemandDrawer';
import { presentationAttributes, type PresentationProps } from '../presentation-contract';
import classes from './ApplicationFrame.module.css';
interface FrameBaseProps extends PresentationProps {
  children: ReactNode;
  navigation?: ReactNode;
}
export interface SiteFrameProps extends FrameBaseProps {
  kind: 'site';
  header: ReactNode;
  footer?: ReactNode;
  navigationOpened: boolean;
  onCloseNavigation: () => void;
  navigationLabel: string;
  closeLabel: string;
  navigationId?: string;
}
export interface WorkspaceFrameProps extends FrameBaseProps {
  kind: 'workspace';
  navigationMode: 'expanded' | 'compact';
  navigationToggle?: { label: string; onToggle: () => void };
}
export type ApplicationFrameProps = SiteFrameProps | WorkspaceFrameProps;
/** The site navigation drawer loads on demand; start when the pointer or focus reaches its toggle. */
function preloadNavigationOnIntent(event: { target: EventTarget }) {
  if (event.target instanceof Element && event.target.closest('[data-menu-toggle]')) {
    preloadDrawer();
  }
}

/** Owns application chrome, safe areas, responsive geometry and print flow. */
export function ApplicationFrame(props: ApplicationFrameProps) {
  const { children, navigation, kind } = props;
  return (
    <div
      {...presentationAttributes(
        Object.fromEntries(Object.entries(props).filter(([key]) => key !== 'onCloseNavigation')),
      )}
      className={classes.root}
      data-frame-kind={kind}
      data-navigation-mode={kind === 'workspace' ? props.navigationMode : undefined}
    >
      {kind === 'site' ? (
        <header
          className={classes.header}
          data-shell-header
          onPointerOverCapture={preloadNavigationOnIntent}
          onFocusCapture={preloadNavigationOnIntent}
          onPointerDownCapture={preloadNavigationOnIntent}
        >
          {props.header}
        </header>
      ) : (
        <aside className={classes.navigation} data-admin-shell-navbar>
          {navigation}
          {props.navigationToggle ? (
            <AriaButton
              className={classes.edgeToggle}
              aria-label={props.navigationToggle.label}
              aria-expanded={props.navigationMode === 'expanded'}
              onPress={props.navigationToggle.onToggle}
              data-admin-navigation-edge-toggle
            />
          ) : null}
        </aside>
      )}
      <main className={classes.main} data-admin-shell-main={kind === 'workspace' || undefined}>
        {children}
      </main>
      {kind === 'site' ? (
        <>
          {props.footer ? (
            <footer className={classes.footer} data-shell-footer>
              {props.footer}
            </footer>
          ) : null}
          <OnDemandDrawer
            id={props.navigationId}
            opened={props.navigationOpened}
            onClose={props.onCloseNavigation}
            placement="left"
            size="compact"
            visibility="mobile-only"
            title={props.navigationLabel}
            closeLabel={props.closeLabel}
          >
            {navigation}
          </OnDemandDrawer>
        </>
      ) : null}
    </div>
  );
}
