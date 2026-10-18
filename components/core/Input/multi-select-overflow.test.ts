import { expect, it } from 'vitest';
import { countVisiblePills } from './multi-select-overflow';

const widths = [72, 112, 96];

it.each([
  ['every pill when pills and gaps fit exactly', 288, 4, 3],
  ['the pills that fit beside the summary when gaps push the row over by one pixel', 287, 4, 2],
  ['the pills that fit beside the summary after the search input reserve', 290 - 100, 0, 1],
  ['one pill when the pill, gap and summary fit exactly', 110, 4, 1],
  ['no pill when the pill, gap and summary exceed the row by one pixel', 109, 4, 0],
  ['no pill when only the summary fits', 50, 0, 0],
  ['every pill while the row has no width yet', 0, 4, 3],
])('shows %s', (_, available, gap, expected) => {
  expect(countVisiblePills({ available, widths, gap, summaryWidth: 34 })).toBe(expected);
});
