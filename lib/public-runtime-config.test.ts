describe('public runtime config', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('reads client runtime config from html dataset', async () => {
    vi.stubGlobal('document', {
      documentElement: {
        dataset: {
          geulCdnUrl: 'https://cdn.example.test',
          geulApiUrl: 'https://api.example.test',
          geulP5RunnerUrl: 'https://runtime.example.run/tools/p5-runner',
          geulGoogleMapsApiKey: 'maps-key',
          geulEditorImageMaxSizeBytes: '73400320',
          geulAuthCodeLifespanSeconds: '720',
          geulAuthCodeResendCooldownSeconds: '45',
        },
      },
    });
    vi.stubGlobal('window', {});

    const runtime = await import('./public-runtime-config');

    expect(runtime.getPublicAuthUrl()).toBe('/api/auth');
    expect(runtime.getPublicCollabUrl()).toBe('/collab');
    expect(runtime.getPublicCdnUrl()).toBe('https://cdn.example.test');
    expect(runtime.getPublicApiUrl()).toBe('https://api.example.test');
    expect(runtime.getPublicP5RunnerUrl()).toBe('https://runtime.example.run/tools/p5-runner');
    expect(runtime.getPublicGoogleMapsApiKey()).toBe('maps-key');
    expect(runtime.getPublicEditorImageMaxSizeBytes()).toBe(73400320);
    expect(runtime.getPublicAuthCodeLifespanSeconds()).toBe(720);
    expect(runtime.getPublicAuthCodeResendCooldownSeconds()).toBe(45);
  });

  it('reads the canonical window bootstrap config when dataset is unavailable', async () => {
    vi.stubGlobal('document', {
      documentElement: {
        dataset: {},
      },
    });
    vi.stubGlobal('window', {
      __GEUL_RUNTIME_CONFIG__: {
        cdnUrl: 'https://bootstrap-cdn.example.test',
        apiUrl: 'https://bootstrap-api.example.test',
        p5RunnerUrl: 'https://bootstrap-runtime.example.run/tools/p5-runner',
        googleMapsApiKey: 'bootstrap-maps-key',
        editorImageMaxSizeBytes: 83886080,
        authCodeLifespanSeconds: 600,
        authCodeResendCooldownSeconds: 30,
      },
    });

    const runtime = await import('./public-runtime-config');

    expect(runtime.getPublicAuthUrl()).toBe('/api/auth');
    expect(runtime.getPublicCollabUrl()).toBe('/collab');
    expect(runtime.getPublicCdnUrl()).toBe('https://bootstrap-cdn.example.test');
    expect(runtime.getPublicApiUrl()).toBe('https://bootstrap-api.example.test');
    expect(runtime.getPublicP5RunnerUrl()).toBe('https://bootstrap-runtime.example.run/tools/p5-runner');
    expect(runtime.getPublicGoogleMapsApiKey()).toBe('bootstrap-maps-key');
    expect(runtime.getPublicEditorImageMaxSizeBytes()).toBe(83886080);
    expect(runtime.getPublicAuthCodeLifespanSeconds()).toBe(600);
    expect(runtime.getPublicAuthCodeResendCooldownSeconds()).toBe(30);
  });

  it('reads the runner dataset independently of the cached core runtime config', async () => {
    const dataset: DOMStringMap = {};
    vi.stubGlobal('document', { documentElement: { dataset } });
    vi.stubGlobal('window', {});

    const runtime = await import('./public-runtime-config');
    expect(runtime.getPublicAuthUrl()).toBe('/api/auth');

    dataset.geulP5RunnerUrl = 'http://127.0.0.1:3000/tools/p5-runner';
    expect(runtime.getPublicP5RunnerUrl()).toBe('http://127.0.0.1:3000/tools/p5-runner');
  });
});
