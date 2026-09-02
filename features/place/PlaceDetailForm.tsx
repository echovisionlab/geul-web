'use client';

import { IconChevronDown } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Accordion, Group, Loader, Stack, Text } from '@mantine/core';
import { TextInput, NumberInput } from '@/components/core/Input';
import type { PlaceEditorFormState } from '@/lib/types/map-place/model';

interface PlaceDetailFormProps {
  formState: PlaceEditorFormState;
  onFormChange: (state: PlaceEditorFormState) => void;
  loading?: boolean;
}

export function PlaceDetailForm({ formState, onFormChange, loading }: PlaceDetailFormProps) {
  const tCommonLabels = useTranslations('common.labels');
  const tCommonPlaceholders = useTranslations('common.placeholders');

  return (
    <Stack gap="md">
      <TextInput
        label={tCommonLabels('name')}
        placeholder={tCommonPlaceholders('placeName')}
        value={formState.name}
        onChange={(e) => onFormChange({ ...formState, name: e.currentTarget.value })}
        required
      />

      <TextInput
        label={tCommonLabels('address')}
        placeholder={tCommonPlaceholders('fullAddress')}
        value={formState.address}
        onChange={(e) => onFormChange({ ...formState, address: e.currentTarget.value })}
        required
      />

      <Group grow>
        <NumberInput
          label={tCommonLabels('latitude')}
          value={formState.lat}
          onChange={(v) => onFormChange({ ...formState, lat: Number(v) || 0, googlePlaceId: null })}
          decimalScale={6}
          step={0.000001}
          size="xs"
        />
        <NumberInput
          label={tCommonLabels('longitude')}
          value={formState.lng}
          onChange={(v) => onFormChange({ ...formState, lng: Number(v) || 0, googlePlaceId: null })}
          decimalScale={6}
          step={0.000001}
          size="xs"
        />
      </Group>

      <Accordion variant="contained" chevron={<IconChevronDown size={16} />}>
        <Accordion.Item value="address-details">
          <Accordion.Control>
            <Group gap="xs">
              <Text size="sm">{tCommonLabels('addressDetails')}</Text>
              {loading && <Loader size={14} />}
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap="sm">
              <TextInput
                label={tCommonLabels('street')}
                placeholder={tCommonPlaceholders('streetAddress')}
                size="xs"
                value={formState.addressComponents?.street ?? ''}
                onChange={(e) =>
                  onFormChange({
                    ...formState,
                    addressComponents: {
                      ...formState.addressComponents,
                      street: e.currentTarget.value || undefined,
                    },
                  })
                }
              />
              <Group grow>
                <TextInput
                  label={tCommonLabels('city')}
                  placeholder={tCommonLabels('city')}
                  size="xs"
                  value={formState.addressComponents?.city ?? ''}
                  onChange={(e) =>
                    onFormChange({
                      ...formState,
                      addressComponents: {
                        ...formState.addressComponents,
                        city: e.currentTarget.value || undefined,
                      },
                    })
                  }
                />
                <TextInput
                  label={tCommonLabels('postalCode')}
                  placeholder={tCommonLabels('postalCode')}
                  size="xs"
                  value={formState.addressComponents?.postalCode ?? ''}
                  onChange={(e) =>
                    onFormChange({
                      ...formState,
                      addressComponents: {
                        ...formState.addressComponents,
                        postalCode: e.currentTarget.value || undefined,
                      },
                    })
                  }
                />
              </Group>
              <Group grow>
                <TextInput
                  label={tCommonLabels('region')}
                  placeholder={tCommonPlaceholders('regionSubdivision')}
                  size="xs"
                  value={formState.addressComponents?.region ?? ''}
                  onChange={(e) =>
                    onFormChange({
                      ...formState,
                      addressComponents: {
                        ...formState.addressComponents,
                        region: e.currentTarget.value || undefined,
                      },
                    })
                  }
                />
                <TextInput
                  label={tCommonLabels('country')}
                  placeholder={tCommonLabels('country')}
                  size="xs"
                  value={formState.addressComponents?.country ?? ''}
                  onChange={(e) =>
                    onFormChange({
                      ...formState,
                      addressComponents: {
                        ...formState.addressComponents,
                        country: e.currentTarget.value || undefined,
                      },
                    })
                  }
                />
              </Group>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Stack>
  );
}
