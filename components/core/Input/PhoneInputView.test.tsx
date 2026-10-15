// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PhoneInputView } from './PhoneInputView';

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
const props = {
  countries: [{ code: 'KR', name: 'South Korea', flag: '🇰🇷', dialCode: '+82' }],
  countryCode: 'KR',
  value: '010-2000-0000',
  labels: { countryName: 'Country', searchPlaceholder: 'Search', noResults: 'No results' },
  onCountryChange: () => {},
  onValueChange: () => {},
};
describe('PhoneInputView country identification', () => {
  it('identifies the country picker separately while preserving its visible search label', () => {
    act(() => root.render(<PhoneInputView {...props} label="Phone number" />));
    expect(host.querySelector('[role="combobox"]')).toHaveAccessibleName('Country Search');
    expect(host.querySelector('input[type="tel"]')).toHaveAccessibleName('Phone number');
    expect([...host.querySelectorAll('label')].map((label) => label.textContent)).toEqual(['Search', 'Phone number']);
  });
  it('uses the country name when no visual label is supplied', () => {
    act(() => root.render(<PhoneInputView {...props} aria-label="Phone number" />));
    expect(host.querySelector('[role="combobox"]')).toHaveAccessibleName('Country');
    expect(host.querySelector('input[type="tel"]')).toHaveAccessibleName('Phone number');
    expect(host.querySelectorAll('label')).toHaveLength(0);
  });
});
