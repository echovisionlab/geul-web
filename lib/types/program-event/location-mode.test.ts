import { ProgramEventLocationMode } from '@echovisionlab/geul-proto/public/program_event_pb.ts';
import { PROGRAM_EVENT_LOCATION_MODE, publicProgramEventLocationModeToString } from './location-mode';

describe('PROGRAM_EVENT_LOCATION_MODE', () => {
  it('mirrors every generated ProgramEventLocationMode wire value', () => {
    const generated = Object.fromEntries(
      Object.entries(ProgramEventLocationMode).filter(([name]) => Number.isNaN(Number(name))),
    );
    expect(PROGRAM_EVENT_LOCATION_MODE).toEqual(generated);
  });

  it('maps wire values to location mode strings', () => {
    expect(publicProgramEventLocationModeToString(ProgramEventLocationMode.ONLINE)).toBe('online');
    expect(publicProgramEventLocationModeToString(ProgramEventLocationMode.HYBRID)).toBe('hybrid');
    expect(publicProgramEventLocationModeToString(ProgramEventLocationMode.TBA)).toBe('tba');
    expect(publicProgramEventLocationModeToString(ProgramEventLocationMode.MAP_PLACE)).toBe('map_place');
    expect(publicProgramEventLocationModeToString(ProgramEventLocationMode.UNSPECIFIED)).toBe('map_place');
  });
});
