'use client';

import { createContext, forwardRef, useContext, type ComponentPropsWithRef, type ReactNode } from 'react';
import {
  Tabs as AriaTabs,
  TabList as AriaTabList,
  Tab as AriaTab,
  TabPanel as AriaTabPanel,
} from 'react-aria-components';
import { controlNativeProps, type ControlNativeProps } from '../control-props';
import type { ControlTone } from '../control-style';
import type { Space } from '../Layout';
import classes from './Tabs.module.css';

export type TabsAppearance = 'line' | 'outline' | 'pills';
export interface TabsProps extends Omit<ControlNativeProps, 'onChange'> {
  children?: ReactNode;
  tone?: ControlTone;
  appearance?: TabsAppearance;
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (value: string | null) => void;
  keepMounted?: boolean;
  orientation?: 'horizontal' | 'vertical';
  activation?: 'automatic' | 'manual';
  disabled?: boolean;
  fill?: boolean;
}
export interface TabsListProps extends ControlNativeProps {
  children?: ReactNode;
  grow?: boolean;
  wrap?: 'wrap' | 'nowrap';
  inset?: Space;
  paddingTop?: Space;
}
export interface TabsTabProps extends ControlNativeProps {
  children?: ReactNode;
  value: string;
  disabled?: boolean;
  leftSection?: ReactNode;
  rightSection?: ReactNode;
  /** Connects this tab to an existing panel outside the Tabs DOM subtree. */
  externalPanel?: { id: string; tabId: string };
}
export interface TabsPanelProps extends ControlNativeProps {
  children?: ReactNode;
  value: string;
  inset?: Space;
  paddingTop?: Space;
}
const MountContext = createContext(true);
const NamingContext = createContext<Pick<ControlNativeProps, 'aria-label' | 'aria-labelledby'>>({});
const TabsRoot = forwardRef<HTMLDivElement, TabsProps>(
  (
    {
      children,
      tone = 'neutral',
      appearance = 'line',
      value,
      defaultValue,
      onChange,
      keepMounted = true,
      orientation = 'horizontal',
      activation = 'automatic',
      disabled = false,
      fill = false,
      ...props
    },
    ref,
  ) => (
    <MountContext.Provider value={keepMounted}>
      <NamingContext.Provider
        value={{ 'aria-label': props['aria-label'], 'aria-labelledby': props['aria-labelledby'] }}
      >
        <AriaTabs
          {...controlNativeProps(props)}
          ref={ref}
          selectedKey={value ?? undefined}
          defaultSelectedKey={defaultValue ?? undefined}
          onSelectionChange={(key) => onChange?.(String(key))}
          orientation={orientation}
          keyboardActivation={activation}
          isDisabled={disabled}
          className={classes.root}
          data-tone={tone}
          data-appearance={appearance}
          data-fill={fill || undefined}
        >
          {children}
        </AriaTabs>
      </NamingContext.Provider>
    </MountContext.Provider>
  ),
);
TabsRoot.displayName = 'Tabs';
const TabsList = forwardRef<HTMLDivElement, TabsListProps>(
  ({ children, grow, wrap = 'wrap', inset = 'none', paddingTop = 'none', ...props }, ref) => {
    const rootName = useContext(NamingContext);
    const ownName = props['aria-label'] !== undefined || props['aria-labelledby'] !== undefined;
    return (
      <AriaTabList
        {...controlNativeProps(props)}
        aria-label={ownName ? props['aria-label'] : rootName['aria-label']}
        aria-labelledby={ownName ? props['aria-labelledby'] : rootName['aria-labelledby']}
        ref={ref}
        className={classes.list}
        data-grow={grow || undefined}
        data-wrap={wrap}
        data-inset={inset}
        data-padding-top={paddingTop}
      >
        {children}
      </AriaTabList>
    );
  },
);
TabsList.displayName = 'Tabs.List';
const TabsTab = forwardRef<HTMLDivElement, TabsTabProps>(
  ({ children, value, disabled, leftSection, rightSection, externalPanel, ...props }, ref) => (
    <AriaTab
      {...controlNativeProps(props)}
      ref={ref}
      id={value}
      isDisabled={disabled}
      className={classes.tab}
      render={
        externalPanel
          ? (domProps) => (
              // Core tabs do not accept href, so React Aria always supplies div props and refs here.
              <div
                {...(domProps as ComponentPropsWithRef<'div'>)}
                id={externalPanel.tabId}
                aria-controls={externalPanel.id}
              />
            )
          : undefined
      }
    >
      {leftSection ? <span className={classes.section}>{leftSection}</span> : null}
      <span>{children}</span>
      {rightSection ? <span className={classes.section}>{rightSection}</span> : null}
    </AriaTab>
  ),
);
TabsTab.displayName = 'Tabs.Tab';
const TabsPanel = forwardRef<HTMLDivElement, TabsPanelProps>(
  ({ children, value, inset = 'none', paddingTop = 'none', ...props }, ref) => {
    const keepMounted = useContext(MountContext);
    return (
      <AriaTabPanel
        {...controlNativeProps(props)}
        ref={ref}
        id={value}
        shouldForceMount={keepMounted}
        className={classes.panel}
        data-inset={inset}
        data-padding-top={paddingTop}
      >
        {children}
      </AriaTabPanel>
    );
  },
);
TabsPanel.displayName = 'Tabs.Panel';
export const Tabs = Object.assign(TabsRoot, { List: TabsList, Tab: TabsTab, Panel: TabsPanel });
