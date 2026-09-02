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

vi.mock('@mantine/core', () => ({
  Stack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
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

const audiences = [{ id: 'audience-1', name: 'Members', segmentTypeLabel: 'Users by Filter' }];

function renderControl(selection: CampaignTargetSelection, onChange = vi.fn(), loadError = false) {
  act(() => {
    root.render(
      <CampaignTargetControl {...selection} audiences={audiences} loadError={loadError} onChange={onChange} />,
    );
  });
  return onChange;
}

describe('CampaignTargetControl', () => {
  it('accepts only complete explicit ALL and SEGMENT targets', () => {
    expect(isCompleteCampaignTarget({ targetMode: CampaignTargetMode.ALL, segmentId: null })).toBe(true);
    expect(
      isCompleteCampaignTarget({
        targetMode: CampaignTargetMode.SEGMENT,
        segmentId: 'audience-1',
      }),
    ).toBe(true);
    expect(
      isCompleteCampaignTarget({
        targetMode: CampaignTargetMode.SEGMENT,
        segmentId: null,
      }),
    ).toBe(false);
    expect(
      isCompleteCampaignTarget({
        targetMode: CampaignTargetMode.ALL,
        segmentId: 'audience-1',
      }),
    ).toBe(false);
  });

  it('allows delivery only to ALL or an active Audience relationship', () => {
    expect(isDeliverableCampaignTarget({ targetMode: CampaignTargetMode.ALL, segmentId: null }, audiences)).toBe(true);
    expect(
      isDeliverableCampaignTarget({ targetMode: CampaignTargetMode.SEGMENT, segmentId: 'audience-1' }, audiences),
    ).toBe(true);
    expect(
      isDeliverableCampaignTarget(
        { targetMode: CampaignTargetMode.SEGMENT, segmentId: 'archived-audience' },
        audiences,
      ),
    ).toBe(false);
  });

  it('maps the single audience control to an explicit mode and relationship', () => {
    const onChange = renderControl({
      targetMode: CampaignTargetMode.ALL,
      segmentId: null,
    });
    const select = container.querySelector('select');
    expect(select).not.toBeNull();

    act(() => {
      select!.value = 'segment:audience-1';
      select!.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith({
      targetMode: CampaignTargetMode.SEGMENT,
      segmentId: 'audience-1',
    });
  });

  it('shows an archived relationship only as a disabled unavailable value', () => {
    renderControl({
      targetMode: CampaignTargetMode.SEGMENT,
      segmentId: 'archived-audience',
    });

    const option = container.querySelector('option[value="segment:archived-audience"]') as HTMLOptionElement | null;
    expect(option?.disabled).toBe(true);
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('unavailableAudienceDescription');
  });

  it('distinguishes an Audience query failure from an archived relationship', () => {
    renderControl(
      {
        targetMode: CampaignTargetMode.SEGMENT,
        segmentId: 'audience-not-yet-verified',
      },
      vi.fn(),
      true,
    );

    expect(container.querySelector('[role="alert"]')?.textContent).toBe('audienceLoadError');
    expect(container.textContent).not.toContain('unavailableAudienceDescription');
  });
});
