import { DynamicModule } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { config as loadDotenv } from 'dotenv';

// Read before the module graph evaluates Observe credentials. ConfigModule
// loads .env later, during Nest bootstrap.
loadDotenv();
import {
  buildObserveRuntimeOptions,
  shouldIgnoreObserveHttp,
  shouldSkipObserveInstrumentation,
} from './observe.policy';

export const { ObserveModule, ObserveInstrument } = createObserveModule({
  // Leave Nest's ConsoleLogger format alone so PM2 stdout stays as it is.
  attachTraceIdToLogs: false,
  sourceContext: {
    linesOfContext: 3,
    maxFrames: 5,
    sourceMaps: true,
  },
  skipInstrumentation: shouldSkipObserveInstrumentation,
});

export function createObserveRootModule(
  env: NodeJS.ProcessEnv = process.env,
): DynamicModule | null {
  const options = buildObserveRuntimeOptions(env);
  if (!options) {
    return null;
  }

  return ObserveModule.forRoot({
    appKey: options.appKey,
    appSecret: options.appSecret,
    serviceId: options.serviceId,
    serviceVersion: options.serviceVersion,
    forwardLogs: options.forwardLogs,
    http: {
      ignore: shouldIgnoreObserveHttp,
      tags: {
        instance: options.serviceId,
        environment: options.environment,
      },
      capture: {
        body: options.captureBody,
      },
    },
  });
}
