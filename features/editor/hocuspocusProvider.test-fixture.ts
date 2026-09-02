import {
  HocuspocusProvider,
  HocuspocusProviderWebsocket,
  type onAuthenticationFailedParameters,
  type onStatelessParameters,
} from '@hocuspocus/provider';

type ProviderFixtureEventMap = {
  stateless: onStatelessParameters;
  authenticationFailed: onAuthenticationFailedParameters;
};

type ProviderFixtureEvent = {
  [EventName in keyof ProviderFixtureEventMap]: readonly [
    eventName: EventName,
    event: ProviderFixtureEventMap[EventName],
  ];
}[keyof ProviderFixtureEventMap];

export type HocuspocusProviderFixture = ReturnType<typeof createHocuspocusProviderFixture>;

export function createHocuspocusProviderFixture(name: string) {
  const websocketProvider = new HocuspocusProviderWebsocket({
    url: 'ws://collaboration.test',
    autoConnect: false,
  });
  const provider = new HocuspocusProvider({
    name,
    websocketProvider,
  });

  return {
    provider,
    emit(...event: ProviderFixtureEvent) {
      if (event[0] === 'stateless') {
        provider.receiveStateless(event[1].payload);
      } else {
        provider.permissionDeniedHandler(event[1].reason);
      }
    },
    destroy() {
      provider.destroy();
      websocketProvider.destroy();
    },
  };
}
