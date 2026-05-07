import * as Sentry from '@sentry/node';

import { config } from '@/config/index';

function initSentry(): void {
  if (!config.sentry.dsn) return;

  Sentry.init({
    dsn: config.sentry.dsn,
    environment: config.sentry.environment,
    release: `dada-backend@${process.env.npm_package_version ?? '0.0.0'}`,
    tracesSampleRate: config.sentry.tracesSampleRate,
  });
}

function captureNonFatal(error: unknown, context?: Record<string, unknown>): void {
  if (!config.sentry.dsn) return;

  Sentry.withScope((scope) => {
    if (context) {
      scope.setExtras(context);
    }
    Sentry.captureException(error);
  });
}

export { captureNonFatal, initSentry };
