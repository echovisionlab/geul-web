// @vitest-environment jsdom

import { act, type ChangeEvent, type ReactNode } from 'react';
import { CampaignTargetMode } from '@echovisionlab/geul-proto/secure/campaign_pb.ts';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CampaignTargetControl,
  isCompleteCampaignTarget,
  isDeliverableCampaignTarget,
  type CampaignTargetSelection,
} from './CampaignTargetControl';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/components/core/Alert', () => ({
  Alert: ({ children }: { children: ReactNode }) => <div role="alert">{children}</div>,
}));

vi.mock('@/components/core/Input', () => ({
  Select: ({
    data,
    label,
    value,
    onChange,
  }: {
    data: Array<{ value: string; label: string; disabled?: boolean }>;
    label: string;
    value: string | null;
    onChange: (value: string | null) => void;
  }) => (
    <label>
      {label}
      <select
        aria-label={label}
        value={value ?? ''}
        onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(event.currentTarget.value || null)}
      >
        {data.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  ),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const criteriaOptions = [{ id: 'criteria-1', name: 'Members', kindLabel: 'Users by Filter' }];

function renderControl(selection: CampaignTargetSelection, onChange = vi.fn(), loadError = false) {
  act(() => {
    root.render(
      <CampaignTargetControl
        {...selection}
        criteriaOptions={criteriaOptions}
        loadError={loadError}
        onChange={onChange}
      />,
    );
  });
  return onChange;
}

describe('CampaignTargetControl', () => {
  it('accepts only complete explicit ALL and SEGMENT targets', () => {
    expect(isCompleteCampaignTarget({ targetMode: CampaignTargetMode.ALL, memberCriteriaId: null })).toBe(true);
    expect(
      isCompleteCampaignTarget({
        targetMode: CampaignTargetMode.MEMBER_CRITERIA,
        memberCriteriaId: 'criteria-1',
      }),
    ).toBe(true);
    expect(
      isCompleteCampaignTarget({
        targetMode: CampaignTargetMode.MEMBER_CRITERIA,
        memberCriteriaId: null,
      }),
    ).toBe(false);
    expect(
      isCompleteCampaignTarget({
        targetMode: CampaignTargetMode.ALL,
        memberCriteriaId: 'criteria-1',
      }),
    ).toBe(false);
  });

  it('allows delivery only to ALL or an active Criteria relationship', () => {
    expect(
      isDeliverableCampaignTarget({ targetMode: CampaignTargetMode.ALL, memberCriteriaId: null }, criteriaOptions),
    ).toBe(true);
    expect(
      isDeliverableCampaignTarget(
        { targetMode: CampaignTargetMode.MEMBER_CRITERIA, memberCriteriaId: 'criteria-1' },
        criteriaOptions,
      ),
    ).toBe(true);
    expect(
      isDeliverableCampaignTarget(
        { targetMode: CampaignTargetMode.MEMBER_CRITERIA, memberCriteriaId: 'archived-criteria' },
        criteriaOptions,
      ),
    ).toBe(false);
  });

  it('maps the single criteria control to an explicit mode and relationship', () => {
    const onChange = renderControl({
      targetMode: CampaignTargetMode.ALL,
      memberCriteriaId: null,
    });
    const select = container.querySelector('select');
    expect(select).not.toBeNull();

    act(() => {
      select!.value = 'criteria:criteria-1';
      select!.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith({
      targetMode: CampaignTargetMode.MEMBER_CRITERIA,
      memberCriteriaId: 'criteria-1',
    });
  });

  it('shows an archived relationship only as a disabled unavailable value', () => {
    renderControl({
      targetMode: CampaignTargetMode.MEMBER_CRITERIA,
      memberCriteriaId: 'archived-criteria',
    });

    const option = container.querySelector('option[value="criteria:archived-criteria"]') as HTMLOptionElement | null;
    expect(option?.disabled).toBe(true);
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('unavailableCriteriaDescription');
  });

  it('distinguishes an Criteria query failure from an archived relationship', () => {
    renderControl(
      {
        targetMode: CampaignTargetMode.MEMBER_CRITERIA,
        memberCriteriaId: 'criteria-not-yet-verified',
      },
      vi.fn(),
      true,
    );

    expect(container.querySelector('[role="alert"]')?.textContent).toBe('criteriaLoadError');
    expect(container.textContent).not.toContain('unavailableCriteriaDescription');
  });
});
