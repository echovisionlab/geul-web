// @vitest-environment jsdom

import { afterEach, expect, it, vi } from 'vitest';
import { act, render, screen } from '@/test/render';
import { PlacesAutocomplete } from './PlacesAutocomplete';

const api = vi.hoisted(() => ({ suggest: vi.fn(), details: vi.fn() }));
const places = {
  AutocompleteSuggestion: { fetchAutocompleteSuggestions: api.suggest },
  Place: class {
    location = { lat: () => 1, lng: () => 2 };
    displayName = 'Selected place';
    fetchFields = api.details;
  },
};
vi.mock('@vis.gl/react-google-maps', () => ({ useMapsLibrary: () => places }));
afterEach(() => vi.resetAllMocks());
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((complete, fail) => {
    resolve = complete;
    reject = fail;
  });
  return { promise, resolve, reject };
}
function suggestions(name: string) {
  return { suggestions: [{ placePrediction: { placeId: name, mainText: { text: name } } }] };
}

it('keeps the newest suggestions when an earlier search finishes late and ignores a response after clearing', async () => {
  const first = deferred<ReturnType<typeof suggestions>>();
  const second = deferred<ReturnType<typeof suggestions>>();
  const cleared = deferred<ReturnType<typeof suggestions>>();
  api.suggest
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise)
    .mockReturnValueOnce(cleared.promise);
  const { user } = render(<PlacesAutocomplete onPlaceSelect={vi.fn()} placeholder="Search places" />);
  const input = screen.getByRole('combobox', { name: 'Search places' });
  await user.click(input);
  await user.paste('old');
  await user.clear(input);
  await user.paste('new');
  expect(input).toHaveAttribute('aria-busy', 'true');
  await act(async () => second.resolve(suggestions('Current place')));
  expect(await screen.findByRole('option', { name: 'Current place' })).toBeVisible();
  await act(async () => first.resolve(suggestions('Old place')));
  expect(screen.queryByRole('option', { name: 'Old place' })).not.toBeInTheDocument();
  await user.clear(input);
  await user.paste('clear');
  await user.clear(input);
  await act(async () => cleared.resolve(suggestions('Late place')));
  expect(input).not.toHaveAttribute('aria-busy', 'true');
  expect(screen.queryByRole('option', { name: 'Late place' })).not.toBeInTheDocument();
});

it('shows selected-place detail pending and ignores completion after the user enters a new search', async () => {
  const details = deferred<void>();
  api.suggest.mockResolvedValue(suggestions('Selected place'));
  api.details.mockReturnValue(details.promise);
  const onPlaceSelect = vi.fn();
  const { user } = render(<PlacesAutocomplete onPlaceSelect={onPlaceSelect} placeholder="Search places" />);
  const input = screen.getByRole('combobox', { name: 'Search places' });
  await user.click(input);
  await user.paste('Selected');
  await user.click(await screen.findByRole('option', { name: 'Selected place' }));
  expect(input).toHaveAttribute('aria-busy', 'true');
  await user.clear(input);
  await act(async () => details.resolve());
  expect(onPlaceSelect).not.toHaveBeenCalled();
  expect(input).not.toHaveAttribute('aria-busy', 'true');
});

it('ends selected-place pending with an error when fetching details rejects', async () => {
  const details = deferred<void>();
  api.suggest.mockResolvedValue(suggestions('Selected place'));
  api.details.mockReturnValue(details.promise);
  const { user } = render(<PlacesAutocomplete onPlaceSelect={vi.fn()} placeholder="Search places" />);
  const input = screen.getByRole('combobox', { name: 'Search places' });
  await user.click(input);
  await user.paste('Selected');
  await user.click(await screen.findByRole('option', { name: 'Selected place' }));
  await act(async () => details.reject(new Error('offline')));
  expect(input).not.toHaveAttribute('aria-busy', 'true');
  expect(input).toHaveAttribute('aria-invalid', 'true');
});
