import { forwardRef } from 'react';
import { Tabs as MantineTabs, type TabsProps as MantineTabsProps } from '@mantine/core';
import { getControlToneColor, type ControlTone } from '../control-style';
import classes from './Tabs.module.css';

export type TabsAppearance = 'line' | 'outline' | 'pills';

export interface TabsProps extends Omit<MantineTabsProps, 'color' | 'radius' | 'variant'> {
  tone?: ControlTone;
  appearance?: TabsAppearance;
}

const APPEARANCE_VARIANTS = {
  line: 'default',
  outline: 'outline',
  pills: 'pills',
} as const;

const TabsRoot = forwardRef<HTMLDivElement, TabsProps>(
  ({ tone = 'accent', appearance = 'line', className, ...props }, ref) => (
    <MantineTabs
      ref={ref}
      {...props}
      className={`${classes.root} ${className ?? ''}`.trim()}
      color={getControlToneColor(tone)}
      variant={APPEARANCE_VARIANTS[appearance]}
      radius={0}
      data-tone={tone}
      data-appearance={appearance}
    />
  ),
);

TabsRoot.displayName = 'Tabs';

export const Tabs = Object.assign(TabsRoot, {
  List: MantineTabs.List,
  Tab: MantineTabs.Tab,
  Panel: MantineTabs.Panel,
});
