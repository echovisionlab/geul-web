'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { FormValidationMessages } from '@/lib/form/validation-messages';

export function useFormValidationMessages(): FormValidationMessages {
  const t = useTranslations('formValidation');

  return useMemo(
    () => ({
      required: t('required'),
      invalidUrl: t('invalidUrl'),
      invalidFormat: t('invalidFormat'),
      invalidEmail: t('invalidEmail'),
      invalidPhoneNumber: t('invalidPhoneNumber'),
      stringGt: (threshold) => t('stringGt', { threshold }),
      stringGte: (threshold) => t('stringGte', { threshold }),
      stringLt: (threshold) => t('stringLt', { threshold }),
      stringLte: (threshold) => t('stringLte', { threshold }),
      stringEq: (threshold) => t('stringEq', { threshold }),
      numberGt: (threshold) => t('numberGt', { threshold }),
      numberGte: (threshold) => t('numberGte', { threshold }),
      numberLt: (threshold) => t('numberLt', { threshold }),
      numberLte: (threshold) => t('numberLte', { threshold }),
      numberEq: (threshold) => t('numberEq', { threshold }),
      arrayGt: (threshold) => t('arrayGt', { threshold }),
      arrayGte: (threshold) => t('arrayGte', { threshold }),
      arrayLt: (threshold) => t('arrayLt', { threshold }),
      arrayLte: (threshold) => t('arrayLte', { threshold }),
      arrayEq: (threshold) => t('arrayEq', { threshold }),
      dateMin: (date) => t('dateMin', { date }),
      dateMax: (date) => t('dateMax', { date }),
      futureDate: t('futureDate'),
      pastDate: t('pastDate'),
      weekdayOnly: t('weekdayOnly'),
      minAge: (age) => t('minAge', { age }),
      maxAge: (age) => t('maxAge', { age }),
    }),
    [t],
  );
}
