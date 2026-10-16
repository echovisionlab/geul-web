// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { getProviderAccessLevel } from '@/lib/collab/provider-control-state';
import { bindRoomAccessScenario, changeCanvasRoomAccess } from './room-access-scenario';

it('changes only its canvas provider and stops handling access changes when its owner is released', () => {
  const firstCanvas = document.createElement('div');
  const secondCanvas = document.createElement('div');
  const firstOwner = document.createElement('span');
  const secondOwner = document.createElement('span');
  firstOwner.dataset.roomAccessScenario = '';
  secondOwner.dataset.roomAccessScenario = '';
  firstCanvas.append(firstOwner);
  secondCanvas.append(secondOwner);
  const firstProvider = {};
  const secondProvider = {};
  const releaseFirst = bindRoomAccessScenario(firstOwner, firstProvider);
  const releaseSecond = bindRoomAccessScenario(secondOwner, secondProvider);
  try {
    expect(changeCanvasRoomAccess(firstCanvas, 'view')).toBe(true);
    expect(getProviderAccessLevel(firstProvider)).toBe('view');
    expect(getProviderAccessLevel(secondProvider)).toBe('edit');
    expect(changeCanvasRoomAccess(firstCanvas, 'edit')).toBe(true);
    expect(getProviderAccessLevel(firstProvider)).toBe('edit');

    releaseFirst();
    expect(changeCanvasRoomAccess(firstCanvas, 'view')).toBe(false);
    expect(getProviderAccessLevel(firstProvider)).toBe('edit');
    firstOwner.remove();
    expect(changeCanvasRoomAccess(firstCanvas, 'view')).toBe(false);
    expect(getProviderAccessLevel(secondProvider)).toBe('edit');
    expect(changeCanvasRoomAccess(secondCanvas, 'view')).toBe(true);
    expect(getProviderAccessLevel(secondProvider)).toBe('view');
  } finally {
    releaseFirst();
    releaseSecond();
  }
});
