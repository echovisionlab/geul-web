import { createClient } from '@connectrpc/connect';
import { SeriesService } from '@echovisionlab/geul-proto/secure/series_pb.ts';
import { createBrowserTransport } from './secure-transport';

export function createSeriesClient() {
  return createClient(SeriesService, createBrowserTransport());
}
