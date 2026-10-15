import type { ProgramEventLocationMode } from '@echovisionlab/geul-proto/public/program_event_pb.ts';

/**
 * Wire values of `api.open.v1.ProgramEventLocationMode`. Client listings import this module; the generated
 * enum would also load `program_event_pb`'s descriptor and the protobuf registry.
 * `location-mode.test.ts` asserts these equal the generated enum.
 */
export const PROGRAM_EVENT_LOCATION_MODE = {
  UNSPECIFIED: 0 as ProgramEventLocationMode.UNSPECIFIED,
  MAP_PLACE: 1 as ProgramEventLocationMode.MAP_PLACE,
  ONLINE: 2 as ProgramEventLocationMode.ONLINE,
  HYBRID: 3 as ProgramEventLocationMode.HYBRID,
  TBA: 4 as ProgramEventLocationMode.TBA,
} as const;

export type ProgramEventLocationModeValue = 'map_place' | 'online' | 'hybrid' | 'tba';

export function publicProgramEventLocationModeToString(mode: ProgramEventLocationMode): ProgramEventLocationModeValue {
  switch (mode) {
    case PROGRAM_EVENT_LOCATION_MODE.ONLINE:
      return 'online';
    case PROGRAM_EVENT_LOCATION_MODE.HYBRID:
      return 'hybrid';
    case PROGRAM_EVENT_LOCATION_MODE.TBA:
      return 'tba';
    case PROGRAM_EVENT_LOCATION_MODE.MAP_PLACE:
    default:
      return 'map_place';
  }
}

export function programEventLocationModeFilterValue(mode: ProgramEventLocationModeValue): string {
  switch (mode) {
    case 'online':
      return 'PROGRAM_EVENT_LOCATION_MODE_ONLINE';
    case 'hybrid':
      return 'PROGRAM_EVENT_LOCATION_MODE_HYBRID';
    case 'tba':
      return 'PROGRAM_EVENT_LOCATION_MODE_TBA';
    case 'map_place':
    default:
      return 'PROGRAM_EVENT_LOCATION_MODE_MAP_PLACE';
  }
}
