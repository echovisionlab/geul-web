'use client';

import { LayoutInset, LayoutStack as DsLayoutStack, LayoutInline as DsLayoutInline } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { Separator } from '@/components/core/Display';
import { SelectionRow, SelectionThumbnail } from '@/components/core/SelectionSurface';
import { useMemo, useState, type ComponentType } from 'react';

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
          data-p5-capability-trigger=""
          data-count={capabilities.length || undefined}
        >
          <IconDevices size={16} aria-hidden />
        </IconButton>
      </Popover.Target>
      <Popover.Dropdown padding="none" role="dialog" data-p5-capability-panel="">
        <DsLayoutStack gap="none">
          <LayoutInset block="xs" inline="sm">
            <DsText weight="strong" size="sm">
              {labels.capabilities}
            </DsText>
            <DsText tone="secondary" size="xs">
              {labels.capabilitiesDescription}
            </DsText>
          </LayoutInset>
          <Separator />
          <DsLayoutStack gap="none" role="group" aria-label={labels.capabilities}>
            {visibleCapabilities.map((capability) => {
              const Icon = CAPABILITY_ICONS[capability];
              const selected = capabilities.includes(capability);
              const suggested = suggestions.has(capability);
              const unsupported = getP5CapabilitySupport(capability) === 'unsupported';
              return (
                <SelectionRow
                  key={capability}
                  selected={selected}
                  appearance={suggested ? 'muted' : 'plain'}
                  onAction={editable ? () => onToggle?.(capability) : undefined}
                  data-p5-capability={capability}
                  data-suggested={suggested || undefined}
                  data-unsupported={unsupported || undefined}
                  leading={
                    editable ? (
                      <Checkbox
                        checked={selected}
                        aria-label={labels.capabilityLabels[capability]}
                        onChange={() => onToggle?.(capability)}
                      />
                    ) : (
                      <SelectionThumbnail icon={<Icon aria-hidden />} size="inline" tone="neutral" />
                    )
                  }
                >
                  <DsLayoutStack as="span" gap="xxs">
                    <DsLayoutInline as="span" justify="between" gap="xs" wrap="nowrap">
                      <DsText as="span" weight="medium" size="sm">
                        {labels.capabilityLabels[capability]}
                      </DsText>
                      {suggested ? (
                        <DsText as="span" tone="accent" size="xs">
                          {labels.suggestedByCode}
                        </DsText>
                      ) : unsupported ? (
                        <DsText as="span" tone="secondary" size="xs">
                          {labels.unsupportedCapability}
                        </DsText>
                      ) : null}
                    </DsLayoutInline>
                    <DsText as="span" font="mono" size="xs" tone="secondary" truncate>
                      {P5_CAPABILITY_API[capability]}
                    </DsText>
                  </DsLayoutStack>
                </SelectionRow>
              );
            })}
          </DsLayoutStack>
        </DsLayoutStack>
      </Popover.Dropdown>
    </Popover>
  );
}
