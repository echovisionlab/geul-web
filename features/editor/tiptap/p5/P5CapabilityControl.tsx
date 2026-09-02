'use client';

import { useMemo, useState, type ComponentType } from 'react';
import { Group, Stack, Text } from '@mantine/core';
import {
  IconBluetooth,
  IconCamera,
  IconDeviceGamepad2,
  IconDeviceMobileRotated,
  IconDevices,
  IconMicrophone,
  IconMapPin,
  IconPiano,
  IconPlugConnected,
  type IconProps,
} from '@tabler/icons-react';
import { Checkbox } from '@/components/core/Input';
import { IconButton } from '@/components/core/IconButton';
import { Popover } from '@/components/core/Popover';
import { getP5CapabilitySupport, P5_CAPABILITIES, P5_CAPABILITY_API, type P5Capability } from './p5-capabilities';
import type { P5SketchLabels } from './p5-node-options';
import classes from './P5CapabilityControl.module.css';

const CAPABILITY_ICONS: Record<P5Capability, ComponentType<IconProps>> = {
  camera: IconCamera,
  microphone: IconMicrophone,
  motion: IconDeviceMobileRotated,
  midi: IconPiano,
  gamepad: IconDeviceGamepad2,
  serial: IconPlugConnected,
  location: IconMapPin,
  bluetooth: IconBluetooth,
};

export function P5CapabilityControl({
  capabilities,
  editable,
  labels,
  suggestedCapabilities = [],
  onToggle,
}: {
  capabilities: readonly P5Capability[];
  editable: boolean;
  labels: Pick<
    P5SketchLabels,
    'capabilities' | 'capabilitiesDescription' | 'suggestedByCode' | 'unsupportedCapability' | 'capabilityLabels'
  >;
  suggestedCapabilities?: readonly P5Capability[];
  onToggle?: (capability: P5Capability) => void;
}) {
  const [open, setOpen] = useState(false);
  const visibleCapabilities = editable ? P5_CAPABILITIES : capabilities;
  const capabilityNames = capabilities.map((capability) => labels.capabilityLabels[capability]);
  const triggerLabel = capabilityNames.length
    ? `${labels.capabilities}: ${capabilityNames.join(', ')}`
    : labels.capabilities;
  const suggestions = useMemo(
    () => new Set(suggestedCapabilities.filter((capability) => !capabilities.includes(capability))),
    [capabilities, suggestedCapabilities],
  );

  if (!editable && capabilities.length === 0) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen} placement="bottom-start" size="standard">
      <Popover.Target>
        <IconButton
          label={triggerLabel}
          title={triggerLabel}
          size="sm"
          tone={capabilities.length > 0 ? 'accent' : 'neutral'}
          emphasis="low"
          aria-expanded={open}
          aria-haspopup="dialog"
          className={classes.trigger}
          data-p5-capability-trigger=""
          data-count={capabilities.length || undefined}
          onClick={() => setOpen((value) => !value)}
        >
          <IconDevices size={16} aria-hidden />
        </IconButton>
      </Popover.Target>
      <Popover.Dropdown padding="none" role="dialog" data-p5-capability-panel="">
        <Stack gap={0}>
          <div className={classes.intro}>
            <Text fw={600} size="sm">
              {labels.capabilities}
            </Text>
            <Text c="dimmed" size="xs">
              {labels.capabilitiesDescription}
            </Text>
          </div>
          <div className={classes.list} role="group" aria-label={labels.capabilities}>
            {visibleCapabilities.map((capability) => {
              const Icon = CAPABILITY_ICONS[capability];
              const selected = capabilities.includes(capability);
              const suggested = suggestions.has(capability);
              const unsupported = getP5CapabilitySupport(capability) === 'unsupported';
              return (
                <label
                  key={capability}
                  className={classes.option}
                  data-p5-capability={capability}
                  data-selected={selected || undefined}
                  data-suggested={suggested || undefined}
                  data-unsupported={unsupported || undefined}
                >
                  {editable ? (
                    <Checkbox
                      checked={selected}
                      aria-label={labels.capabilityLabels[capability]}
                      onChange={() => onToggle?.(capability)}
                    />
                  ) : (
                    <span className={classes.icon} aria-hidden>
                      <Icon size={17} />
                    </span>
                  )}
                  <span className={classes.optionBody}>
                    <Group justify="space-between" gap="xs" wrap="nowrap">
                      <Text component="span" fw={500} size="sm">
                        {labels.capabilityLabels[capability]}
                      </Text>
                      {suggested ? (
                        <Text component="span" c="blue" size="xs">
                          {labels.suggestedByCode}
                        </Text>
                      ) : unsupported ? (
                        <Text component="span" c="dimmed" size="xs">
                          {labels.unsupportedCapability}
                        </Text>
                      ) : null}
                    </Group>
                    <code className={classes.api}>{P5_CAPABILITY_API[capability]}</code>
                  </span>
                </label>
              );
            })}
          </div>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
