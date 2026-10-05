import { createClient } from '@connectrpc/connect';
import { ArtistService } from '@echovisionlab/geul-proto/secure/artist_pb.ts';
import { createBrowserTransport } from './secure-transport';

export function createArtistClient() {
  return createClient(ArtistService, createBrowserTransport());
}
