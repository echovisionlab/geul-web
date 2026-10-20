'use client';
import type { ReactNode } from 'react';
import { Button as AriaButton } from 'react-aria-components';
import { presentationAttributes, type PresentationProps } from '../presentation-contract';
import classes from './ApplicationFrame.module.css';
import { SiteNavigationPanel } from './SiteNavigationPanel';
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
  /** Accessible name of the phone navigation panel; the header's MenuToggle opens and closes it. */
  navigationLabel: string;
  navigationId?: string;
}
export interface WorkspaceFrameProps extends FrameBaseProps {
  kind: 'workspace';
  navigationMode: 'expanded' | 'compact';
  navigationToggle?: { label: string; onToggle: () => void };
}
export type ApplicationFrameProps = SiteFrameProps | WorkspaceFrameProps;

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
        <header className={classes.header} data-shell-header>
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
          <SiteNavigationPanel
            id={props.navigationId}
            opened={props.navigationOpened}
            onClose={props.onCloseNavigation}
            label={props.navigationLabel}
          >
            {navigation}
          </SiteNavigationPanel>
        </>
      ) : null}
    </div>
  );
}
