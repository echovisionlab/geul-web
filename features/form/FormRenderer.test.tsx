// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildForm } from '@/lib/form/build';
import type { FormSchema } from '@/lib/types/form/schema';
import { TestProviders } from '@/test/TestProviders';
import { FormRenderer } from './FormRenderer';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
});

Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
  writable: true,
  value: vi.fn(),
});

let container: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
});

function renderPhoneRequiredForm(requiredMessage: string) {
  const schema: FormSchema = {
    id: 'phone-required-form',
    steps: [
      {
        id: 'phone-step',
        title: 'Phone Step',
        fields: [
          {
            id: 'field-phone',
            name: 'phone',
            label: 'Phone',
            type: 'tel',
            validation: {
              validators: [
                {
                  id: 'validator-phone-required',
                  name: 'Required',
                  predicate: 'required',
                  message: requiredMessage,
                },
              ],
            },
          },
        ],
      },
    ],
  };

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <TestProviders>
        <FormRenderer form={buildForm(schema)} />
      </TestProviders>,
    );
  });
}

function renderPhoneDefaultCountryForm(phoneDefaultCountry: string) {
  const schema: FormSchema = {
    id: 'phone-default-country-form',
    steps: [
      {
        id: 'phone-step',
        title: 'Phone Step',
        fields: [
          {
            id: 'field-phone',
            name: 'phone',
            label: 'Phone',
            type: 'tel',
          },
        ],
      },
    ],
  };

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <TestProviders>
        <FormRenderer form={buildForm(schema)} phoneDefaultCountry={phoneDefaultCountry} />
      </TestProviders>,
    );
  });
}

function renderSingleStepSubmitForm(onSubmit: () => Promise<void>) {
  const schema: FormSchema = {
    id: 'submit-form',
    steps: [
      {
        id: 'submit-step',
        title: 'Submit Step',
        fields: [],
      },
    ],
  };

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <TestProviders>
        <FormRenderer form={buildForm(schema)} onSubmit={onSubmit} />
      </TestProviders>,
    );
  });
}

function renderMultiStepForm() {
  const schema: FormSchema = {
    id: 'multi-step-form',
    steps: [
      {
        id: 'step-1',
        title: 'Step One',
        fields: [],
      },
      {
        id: 'step-2',
        title: 'Step Two',
        fields: [],
      },
    ],
  };

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <TestProviders>
        <FormRenderer form={buildForm(schema)} />
      </TestProviders>,
    );
  });
}

async function flushUpdates() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('FormRenderer', () => {
  it('renders the phone required error once after blur', async () => {
    const requiredMessage = 'Phone is required exactly once';

    renderPhoneRequiredForm(requiredMessage);

    const phoneInput = container?.querySelector('input[type="tel"]') as HTMLInputElement | null;
    expect(phoneInput).not.toBeNull();

    act(() => {
      phoneInput?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      phoneInput?.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
    await flushUpdates();

    const textContent = container?.textContent ?? '';
    const occurrences = textContent.split(requiredMessage).length - 1;

    expect(occurrences).toBe(1);
  });

  it('passes the resolved phone default country to phone fields', () => {
    renderPhoneDefaultCountryForm('JP');

    expect(container?.textContent).toContain('+81');
  });

  it('does not render an internal completion screen after submit resolves', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    renderSingleStepSubmitForm(onSubmit);

    const submitButton = Array.from(container?.querySelectorAll('button') ?? []).find((button) =>
      button.textContent?.includes('Submit'),
    );
    expect(submitButton).not.toBeNull();

    await act(async () => {
      submitButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(container?.textContent).not.toContain('Submitted');
    expect(container?.textContent).toContain('Submit Step');
  });

  it('submits the current step on Enter when the form is valid', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    renderSingleStepSubmitForm(onSubmit);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await Promise.resolve();
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('hides the progress bar when only one step is visible', () => {
    renderSingleStepSubmitForm(vi.fn().mockResolvedValue(undefined));

    expect(container?.querySelector('[role="progressbar"]')).toBeNull();
  });

  it('renders the progress bar for multi-step forms', () => {
    renderMultiStepForm();

    expect(container?.querySelector('[role="progressbar"]')).not.toBeNull();
  });

  it('hides the previous button on the first step', async () => {
    renderMultiStepForm();
    await flushUpdates();

    const buttons = Array.from(container?.querySelectorAll('button') ?? []);
    expect(buttons.some((button) => button.textContent?.includes('Previous'))).toBe(false);
    expect(buttons.some((button) => button.textContent?.includes('Next'))).toBe(true);
  });

  it('shows the previous button after advancing past the first step', async () => {
    renderMultiStepForm();
    await flushUpdates();

    const nextButton = Array.from(container?.querySelectorAll('button') ?? []).find((button) =>
      button.textContent?.includes('Next'),
    );
    expect(nextButton).not.toBeNull();

    await act(async () => {
      nextButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(container?.textContent).toContain('Step Two');
    expect(
      Array.from(container?.querySelectorAll('button') ?? []).some((button) =>
        button.textContent?.includes('Previous'),
      ),
    ).toBe(true);
  });
});
