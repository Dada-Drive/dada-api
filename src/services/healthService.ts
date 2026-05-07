import { getFirebaseApp } from '@/config/firebase';
import { pingRedis } from '@/config/redis';
import { sequelize } from '@/models/index';

// ── Types ────────────────────────────────────────────────────────────────────

interface DependencyCheck {
  status: 'healthy' | 'unhealthy';
  latency?: string;
}

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  version: string;
  uptime: number;
  timestamp: string;
  checks: {
    database: DependencyCheck;
    redis: DependencyCheck;
    firebase: DependencyCheck;
  };
}

// ── Version ──────────────────────────────────────────────────────────────────

const APP_VERSION = process.env.npm_package_version ?? '0.0.0';

// ── Individual checks ────────────────────────────────────────────────────────

async function checkDatabase(): Promise<DependencyCheck> {
  const start = process.hrtime.bigint();
  try {
    await sequelize.authenticate();
    const ms = Number(process.hrtime.bigint() - start) / 1_000_000;
    return { status: 'healthy', latency: `${ms.toFixed(0)}ms` };
  } catch {
    return { status: 'unhealthy' };
  }
}

async function checkRedis(): Promise<DependencyCheck> {
  const start = process.hrtime.bigint();
  try {
    const ok = await pingRedis();
    const ms = Number(process.hrtime.bigint() - start) / 1_000_000;
    return ok ? { status: 'healthy', latency: `${ms.toFixed(0)}ms` } : { status: 'unhealthy' };
  } catch {
    return { status: 'unhealthy' };
  }
}

function checkFirebase(): DependencyCheck {
  try {
    getFirebaseApp();
    return { status: 'healthy' };
  } catch {
    return { status: 'unhealthy' };
  }
}

// ── Aggregate ────────────────────────────────────────────────────────────────

async function getHealthStatus(): Promise<HealthCheckResult> {
  const [database, redis] = await Promise.all([checkDatabase(), checkRedis()]);
  const firebase = checkFirebase();

  const allHealthy =
    database.status === 'healthy' && redis.status === 'healthy' && firebase.status === 'healthy';

  return {
    status: allHealthy ? 'healthy' : 'unhealthy',
    version: APP_VERSION,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    checks: { database, redis, firebase },
  };
}

export { getHealthStatus };

export type { HealthCheckResult };
