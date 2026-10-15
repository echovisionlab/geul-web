'use client';

import { LayoutStack as DsLayoutStack, LayoutInline as DsLayoutInline } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { useTranslations } from 'next-intl';
import { Disclosure } from '@/components/core/Disclosure';
import { Spinner as Loader } from '@/components/core/Display';
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
    <DsLayoutStack gap="md">
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

      <DsLayoutInline grow>
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
      </DsLayoutInline>

      <Disclosure
        appearance="filled"
        label={
          <>
            <DsText as="span" size="sm">
              {tCommonLabels('addressDetails')}
            </DsText>
            {loading && <Loader size="xs" />}
          </>
        }
      >
        <DsLayoutStack gap="sm">
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
          <DsLayoutInline grow>
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
          </DsLayoutInline>
          <DsLayoutInline grow>
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
          </DsLayoutInline>
        </DsLayoutStack>
      </Disclosure>
    </DsLayoutStack>
  );
}
