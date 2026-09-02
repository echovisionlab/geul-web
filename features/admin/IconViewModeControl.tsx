'use client';

import type { ReactNode } from 'react';
import { Box } from '@mantine/core';
import { SegmentedControl } from '@/components/core/Input';
import { Tooltip } from '@/components/core/Tooltip';

export interface IconViewModeOption<T extends string> {
  value: T;
  icon: ReactNode;
  tooltip: string;
}

interface IconViewModeControlProps<T extends string> {
  value: T;
  options: IconViewModeOption<T>[];
  onChange: (value: T) => void;
}

export function IconViewModeControl<T extends string>({ value, options, onChange }: IconViewModeControlProps<T>) {
  return (
    <SegmentedControl
      value={value}
      onChange={(nextValue) => onChange(nextValue as T)}
      styles={{
        label: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          paddingInline: '0.625rem',
        },
        innerLabel: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 18,
          lineHeight: 1,
        },
      }}
      data={options.map((option) => ({
        value: option.value,
        label: (
          <Tooltip label={option.tooltip} withArrow openDelay={120}>
            <Box
              component="span"
              style={{
                width: 18,
                height: 18,
                lineHeight: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                verticalAlign: 'middle',
              }}
              aria-label={option.tooltip}
            >
              {option.icon}
            </Box>
          </Tooltip>
        ),
      }))}
    />
  );
}
