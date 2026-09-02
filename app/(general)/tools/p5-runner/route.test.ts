import { buildP5RunnerDocument } from './p5-runner-document';
import { GET, getP5RunnerDeploymentConfig } from './route';

describe('isolated p5 device runner route', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('serves only the configured isolated host with restrictive capability headers', async () => {
    vi.stubEnv('SITE_ORIGIN', 'https://www.example.invalid');
    vi.stubEnv('PUBLIC_P5_RUNNER_URL', 'https://runtime.example.test/tools/p5-runner');

    const response = GET(
      new Request('https://runtime.example.test/tools/p5-runner', {
        headers: { host: 'runtime.example.test' },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('cross-origin-resource-policy')).toBe('cross-origin');
    expect(response.headers.get('permissions-policy')).toContain('camera=(self)');
    expect(response.headers.get('permissions-policy')).toContain('microphone=(self)');
    expect(response.headers.get('permissions-policy')).toContain('geolocation=(self)');
    expect(response.headers.get('permissions-policy')).toContain('bluetooth=(self)');
    expect(response.headers.get('content-security-policy')).toContain('frame-ancestors https://www.example.invalid');
    expect(response.headers.get('content-security-policy')).toContain("connect-src 'none'");
    const html = await response.text();
    expect(html).toContain("location.hash.slice(1)).get('channel')");
    expect(html).toContain('event.origin !== parentOrigin');
    expect(html).toContain('/vendors/p5/p5.min.js');
    expect(html).not.toContain('allow-same-origin');
  });

  it('does not serve the runner document from the site host', () => {
    vi.stubEnv('SITE_ORIGIN', 'https://www.example.invalid');
    vi.stubEnv('PUBLIC_P5_RUNNER_URL', 'https://runtime.example.test/tools/p5-runner');

    const response = GET(
      new Request('https://www.example.invalid/tools/p5-runner', {
        headers: { host: 'www.example.invalid' },
      }),
    );

    expect(response.status).toBe(404);
  });

  it('rejects a runner under the site cookie domain', () => {
    expect(
      getP5RunnerDeploymentConfig({
        SITE_ORIGIN: 'https://www.example.invalid',
        PUBLIC_P5_RUNNER_URL: 'https://runtime.example.invalid/tools/p5-runner',
      }),
    ).toBeNull();
  });

  it('hash-allows only the pinned p5 asset and exact boot script', () => {
    const document = buildP5RunnerDocument('https://www.example.invalid');

    expect(document.contentSecurityPolicy).toMatch(/script-src 'sha256-[^']+' 'sha384-[^']+' 'unsafe-eval'/u);
    expect(document.html).toContain('function installP5DeviceRunner');
    expect(document.html).toContain('permission-pending');
    expect(document.html).toContain('requestCurrentPosition');
    expect(document.html).toContain('requestBluetoothDevice');
    expect(document.html).toContain('device.gatt?.disconnect?.()');
    expect(document.html).not.toContain('cdn.jsdelivr.net');
    expect(document.html).not.toContain('author source');
  });
});
