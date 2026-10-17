import type { ReactNode } from 'react';
import type { ClosedVisualProps } from '../visual-contract';
import { LayoutVisibility } from '../Layout';
import classes from './ApplicationFrame.module.css';

export interface SiteHeaderProps extends ClosedVisualProps {
  logo: ReactNode;
  navigationToggle: ReactNode;
  /** Actions beside the hamburger; keep this group as wide as `mobileActions` so the centered brand has even space. */
  mobileLeadingActions?: ReactNode;
  mobileActions: ReactNode;
  desktopActions: ReactNode;
}

/** Responsive site chrome. Uses the same breakpoint as MenuToggle and the navigation drawer. */
export function SiteHeader({
  logo,
  navigationToggle,
  mobileLeadingActions,
  mobileActions,
  desktopActions,
}: SiteHeaderProps) {
  return (
    <div className={classes.headerRow} data-site-header>
      <div className={classes.headerLeading}>
        {navigationToggle}
        <LayoutVisibility hiddenFrom="sm">{mobileLeadingActions}</LayoutVisibility>
      </div>
      <div className={classes.headerBrand} data-site-header-brand>
        {logo}
      </div>
      <LayoutVisibility visibleFrom="sm">
        <div className={classes.headerDesktopActions}>{desktopActions}</div>
      </LayoutVisibility>
      <LayoutVisibility hiddenFrom="sm">
        <div className={classes.headerActions}>{mobileActions}</div>
      </LayoutVisibility>
    </div>
  );
}
