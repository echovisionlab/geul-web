// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ParameterPanel } from '@/components/core/ParameterPanel';
import { DEFAULT_MAP_CONFIG, type MapConfig } from '@/lib/types/map/model';
import { useMapParameterControls } from './MapParameterControls';
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
let host: HTMLDivElement;
let root: Root;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});
function Harness({ config, onChange }: { config: MapConfig; onChange: (value: Partial<MapConfig>) => void }) {
  const { model } = useMapParameterControls({ config, onConfigChange: onChange });
  return <ParameterPanel title="Settings" model={model} />;
}
function render(config: MapConfig, onChange = vi.fn()) {
  if (!host) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  }
  act(() => root.render(<Harness config={config} onChange={onChange} />));
  return onChange;
}
function expand(name: string) {
  const trigger = Array.from(host.querySelectorAll('button')).find((b) => b.textContent === name);
  act(() => trigger?.click());
}
function checkbox(label: string) {
  const element =
    host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`) ??
    Array.from(host.querySelectorAll<HTMLInputElement>('input[type=checkbox]')).find((i) =>
      i.closest('label')?.textContent?.includes(label),
    );
  expect(element).toBeTruthy();
  return element!;
}
describe('controlled map parameter controls', () => {
  it('reconciles all durable toggles after external document changes without callbacks', () => {
    host = undefined!;
    const change = render(DEFAULT_MAP_CONFIG);
    expand('folders.interaction');
    const config = {
      ...DEFAULT_MAP_CONFIG,
      draggable: false,
      zoomable: false,
      rotatable: true,
      tiltable: true,
      pinClickable: false,
      showDirections: false,
    };
    render(config, change);
    for (const field of ['draggable', 'zoomable', 'rotatable', 'tiltable', 'pinClickable'] as const) {
      expect(checkbox(`fields.${field}`).checked).toBe(config[field]);
    }
    expect(checkbox('directions').checked).toBe(false);
    expect(change).not.toHaveBeenCalled();
  });
  it('preserves visible 3D activation and current external camera state', () => {
    host = undefined!;
    const change = render({ ...DEFAULT_MAP_CONFIG, show3DBuildings: false, pitch: 0, tiltable: false });
    expand('folders.display');
    act(() => checkbox('fields.show3DBuildings').click());
    expect(change).toHaveBeenCalledWith({ show3DBuildings: true, pitch: 45, tiltable: true });
  });
});
