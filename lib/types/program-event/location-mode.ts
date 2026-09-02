import { ProgramEventLocationMode } from '@echovisionlab/geul-proto/public/program_event_pb.ts';

export type ProgramEventLocationModeValue = 'map_place' | 'online' | 'hybrid' | 'tba';

export function publicProgramEventLocationModeToString(mode: ProgramEventLocationMode): ProgramEventLocationModeValue {
  switch (mode) {
    case ProgramEventLocationMode.ONLINE:
      return 'online';
    case ProgramEventLocationMode.HYBRID:
      return 'hybrid';
    case ProgramEventLocationMode.TBA:
      return 'tba';
    case ProgramEventLocationMode.MAP_PLACE:
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
