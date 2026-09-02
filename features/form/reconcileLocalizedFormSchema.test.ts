import { describe, expect, it } from 'vitest';
import type { FormSchema } from '@/lib/types/form/schema';
import { reconcileLocalizedFormSchema } from './reconcileLocalizedFormSchema';

describe('reconcileLocalizedFormSchema', () => {
  it('drops locale-only removed steps while keeping localized text for matching source steps', () => {
    const sourceSchema: FormSchema = {
      id: 'form-1',
      steps: [
        {
          id: 'step-contact',
          title: 'Contact',
          description: 'How can we reach you?',
          fields: [
            {
              id: 'field-email',
              key: 'email',
              label: 'Email',
              description: 'Your email address',
              placeholder: 'you@example.com',
              type: 'email',
            },
          ],
        },
      ],
    };

    const localizedSchema: FormSchema = {
      id: 'form-1',
      steps: [
        {
          id: 'step-contact',
          title: '문의',
          description: '어떻게 연락드릴까요?',
          fields: [
            {
              id: 'field-email',
              key: 'email',
              label: '이메일',
              description: '이메일 주소',
              placeholder: 'name@example.com',
              type: 'email',
            },
          ],
        },
        {
          id: 'step-deleted',
          title: '삭제된 단계',
          fields: [],
        },
      ],
    };

    expect(reconcileLocalizedFormSchema(sourceSchema, localizedSchema)).toEqual({
      id: 'form-1',
      steps: [
        {
          id: 'step-contact',
          title: '문의',
          description: '어떻게 연락드릴까요?',
          fields: [
            {
              id: 'field-email',
              key: 'email',
              label: '이메일',
              description: '이메일 주소',
              placeholder: 'name@example.com',
              type: 'email',
            },
          ],
        },
      ],
    });
  });

  it('keeps source structure and neutral props for newly added steps and fields', () => {
    const sourceSchema: FormSchema = {
      id: 'form-1',
      steps: [
        {
          id: 'step-contact',
          title: 'Contact',
          fields: [
            {
              id: 'field-email',
              key: 'email',
              label: 'Email',
              type: 'email',
            },
          ],
        },
        {
          id: 'step-phone',
          title: 'Phone',
          fields: [
            {
              id: 'field-phone',
              key: 'phone',
              label: 'Phone number',
              type: 'tel',
              defaultCountry: 'US',
            },
          ],
        },
      ],
    };

    const localizedSchema: FormSchema = {
      id: 'form-1',
      steps: [
        {
          id: 'step-contact',
          title: '문의',
          fields: [
            {
              id: 'field-email',
              key: 'email',
              label: '이메일',
              type: 'email',
            },
          ],
        },
      ],
    };

    expect(reconcileLocalizedFormSchema(sourceSchema, localizedSchema)).toEqual({
      id: 'form-1',
      steps: [
        {
          id: 'step-contact',
          title: '문의',
          fields: [
            {
              id: 'field-email',
              key: 'email',
              label: '이메일',
              type: 'email',
            },
          ],
        },
        {
          id: 'step-phone',
          title: 'Phone',
          fields: [
            {
              id: 'field-phone',
              key: 'phone',
              label: 'Phone number',
              type: 'tel',
              defaultCountry: 'US',
            },
          ],
        },
      ],
    });
  });

  it('matches localized option labels by value when option ids are absent', () => {
    const sourceSchema: FormSchema = {
      id: 'form-1',
      steps: [
        {
          id: 'step-contact',
          title: 'Contact',
          fields: [
            {
              id: 'field-topic',
              key: 'topic',
              label: 'Topic',
              type: 'select',
              options: [
                { value: 'billing', label: 'Billing' },
                { value: 'support', label: 'Support' },
              ],
            },
          ],
        },
      ],
    };

    const localizedSchema: FormSchema = {
      id: 'form-1',
      steps: [
        {
          id: 'step-contact',
          title: '문의',
          fields: [
            {
              id: 'field-topic',
              key: 'topic',
              label: '주제',
              type: 'select',
              options: [
                { value: 'support', label: '지원' },
                { value: 'billing', label: '청구' },
              ],
            },
          ],
        },
      ],
    };

    expect(reconcileLocalizedFormSchema(sourceSchema, localizedSchema)).toEqual({
      id: 'form-1',
      steps: [
        {
          id: 'step-contact',
          title: '문의',
          fields: [
            {
              id: 'field-topic',
              key: 'topic',
              label: '주제',
              type: 'select',
              options: [
                { value: 'billing', label: '청구' },
                { value: 'support', label: '지원' },
              ],
            },
          ],
        },
      ],
    });
  });
});
