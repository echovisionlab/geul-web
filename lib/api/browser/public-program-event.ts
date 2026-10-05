import { createClient } from '@connectrpc/connect';
import {
  ProgramEventService as PublicProgramEventService,
  ProgramEventSeriesService as PublicProgramEventSeriesService,
  ProgramEventTypeService as PublicProgramEventTypeService,
} from '@echovisionlab/geul-proto/public/program_event_pb.ts';
import { createPublicBrowserTransport } from './public-transport';

export function createPublicProgramEventClientWithLocale(acceptLanguageOverride?: string | null) {
  return createClient(PublicProgramEventService, createPublicBrowserTransport(acceptLanguageOverride));
}

export function createPublicProgramEventSeriesClientWithLocale(acceptLanguageOverride?: string | null) {
  return createClient(PublicProgramEventSeriesService, createPublicBrowserTransport(acceptLanguageOverride));
}

export function createPublicProgramEventTypeClientWithLocale(acceptLanguageOverride?: string | null) {
  return createClient(PublicProgramEventTypeService, createPublicBrowserTransport(acceptLanguageOverride));
}
