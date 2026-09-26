import {
  buildObserveRuntimeOptions,
  observeEnabled,
  shouldIgnoreObserveHttp,
  shouldSkipObserveInstrumentation,
} from './observe.policy';

const enabledEnv = {
  NODE_ENV: 'production',
  OBSERVE_APP_KEY: 'app-key',
  OBSERVE_APP_SECRET: 'app-secret',
  INSTANCE_ID: 'ezprep',
} as NodeJS.ProcessEnv;

describe('NestJS Observe send policy', () => {
  it('does not forward application logs', () => {
    const options = buildObserveRuntimeOptions(enabledEnv);
    expect(options).toMatchObject({
      forwardLogs: false,
      captureBody: false,
      serviceId: 'ezprep',
      appKey: 'app-key',
    });
  });

  it('stays off without credentials, in tests, and on whitespace secrets', () => {
    expect(
      observeEnabled({
        NODE_ENV: 'production',
        OBSERVE_APP_KEY: '  ',
        OBSERVE_APP_SECRET: 'secret',
      }),
    ).toBe(false);
    expect(
      observeEnabled({
        NODE_ENV: 'test',
        OBSERVE_APP_KEY: 'key',
        OBSERVE_APP_SECRET: 'secret',
      }),
    ).toBe(false);
    expect(
      observeEnabled({
        NODE_ENV: 'production',
        JEST_WORKER_ID: '1',
        OBSERVE_APP_KEY: 'key',
        OBSERVE_APP_SECRET: 'secret',
      }),
    ).toBe(false);
    expect(buildObserveRuntimeOptions({ NODE_ENV: 'production' })).toBeNull();
  });

  it('ignores probes and keeps application routes', () => {
    expect(
      shouldIgnoreObserveHttp({ url: '/api/v1/health', method: 'GET' }),
    ).toBe(true);
    expect(
      shouldIgnoreObserveHttp({ url: '/api/v1/health?ready=1', method: 'GET' }),
    ).toBe(true);
    expect(shouldIgnoreObserveHttp({ url: '/api/docs/', method: 'GET' })).toBe(
      true,
    );
    expect(
      shouldIgnoreObserveHttp({
        url: '/api/docs/swagger-ui.css',
        method: 'GET',
      }),
    ).toBe(true);
    expect(
      shouldIgnoreObserveHttp({ url: '/favicon.ico', method: 'GET' }),
    ).toBe(true);
    expect(
      shouldIgnoreObserveHttp({ url: '/api/v1/auth/login', method: 'POST' }),
    ).toBe(false);
    expect(
      shouldIgnoreObserveHttp({ url: '/api/v1/mock-tests', method: 'GET' }),
    ).toBe(false);
    expect(shouldIgnoreObserveHttp({})).toBe(false);
  });

  it('skips per-request plumbing and keeps application services', () => {
    class LoggingInterceptor {}
    class ImportService {}
    expect(shouldSkipObserveInstrumentation(new LoggingInterceptor())).toBe(
      true,
    );
    expect(shouldSkipObserveInstrumentation(new ImportService())).toBe(false);
    expect(shouldSkipObserveInstrumentation(null)).toBe(false);
    expect(shouldSkipObserveInstrumentation('LoggingInterceptor')).toBe(false);
    expect(shouldSkipObserveInstrumentation(Object.create(null))).toBe(false);
  });

  it('includes an optional release marker when one is set', () => {
    expect(
      buildObserveRuntimeOptions({
        ...enabledEnv,
        OBSERVE_SERVICE_VERSION: 'abc123',
      })?.serviceVersion,
    ).toBe('abc123');
  });
});
