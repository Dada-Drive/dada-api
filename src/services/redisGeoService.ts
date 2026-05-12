import { redisClient } from '@/config/redis';
import { logger } from '@/utils/logger';

import type { VehicleType } from '@/types/enums';

// ── Constants ───────────────────────────────────────────────────────────────

const GEO_KEY = 'drivers:online';
const META_PREFIX = 'driver:';
const META_SUFFIX = ':meta';
const META_TTL = 120; // 2 minutes — heartbeat refresh window
const MAX_RESULTS = 50;

// ── Types ───────────────────────────────────────────────────────────────────

interface DriverMeta {
  vehicleType: string;
  rating: string;
  fullName: string;
  heading: string;
}

interface NearbyDriver {
  driverId: string;
  distanceKm: number;
  lat: number;
  lng: number;
  vehicleType: string;
  rating: number;
  fullName: string;
  heading: number | null;
}

// ── Update Driver Location ──────────────────────────────────────────────────

async function updateDriverLocation(
  driverId: string,
  lat: number,
  lng: number,
  meta: { vehicleType: VehicleType; rating: number | null; fullName: string; heading?: number },
): Promise<void> {
  try {
    const metaKey = `${META_PREFIX}${driverId}${META_SUFFIX}`;
    const pipeline = redisClient.pipeline();

    pipeline.geoadd(GEO_KEY, lng, lat, driverId);
    pipeline.hset(metaKey, {
      vehicleType: meta.vehicleType,
      rating: String(meta.rating ?? '0'),
      fullName: meta.fullName,
      heading: String(meta.heading ?? ''),
    });
    pipeline.expire(metaKey, META_TTL);

    await pipeline.exec();
  } catch (err) {
    logger.warn('RedisGeo: updateDriverLocation failed', {
      driverId,
      error: err instanceof Error ? err.message : String(err),
      component: 'redis-geo',
    });
  }
}

// ── Remove Driver ───────────────────────────────────────────────────────────

async function removeDriver(driverId: string): Promise<void> {
  try {
    const metaKey = `${META_PREFIX}${driverId}${META_SUFFIX}`;
    const pipeline = redisClient.pipeline();

    pipeline.zrem(GEO_KEY, driverId);
    pipeline.del(metaKey);

    await pipeline.exec();
  } catch (err) {
    logger.warn('RedisGeo: removeDriver failed', {
      driverId,
      error: err instanceof Error ? err.message : String(err),
      component: 'redis-geo',
    });
  }
}

// ── Get Nearby Drivers ──────────────────────────────────────────────────────

async function getNearbyDrivers(
  lat: number,
  lng: number,
  radiusKm: number,
  vehicleType?: VehicleType,
): Promise<NearbyDriver[]> {
  try {
    // GEOSEARCH returns: [[member, distance, [lng, lat]], ...]
    const results = (await redisClient.geosearch(
      GEO_KEY,
      'FROMLONLAT',
      lng,
      lat,
      'BYRADIUS',
      radiusKm,
      'km',
      'ASC',
      'COUNT',
      MAX_RESULTS,
      'WITHDIST',
      'WITHCOORD',
    )) as Array<[string, string, [string, string]]>;

    if (!results || results.length === 0) return [];

    // Batch-fetch metadata for all drivers
    const pipeline = redisClient.pipeline();
    for (const entry of results) {
      const driverId = entry[0];
      pipeline.hgetall(`${META_PREFIX}${driverId}${META_SUFFIX}`);
    }
    const metaResults = await pipeline.exec();

    const drivers: NearbyDriver[] = [];
    const staleIds: string[] = [];

    for (let i = 0; i < results.length; i++) {
      const [driverId, dist, coords] = results[i]!;
      const metaResult = metaResults?.[i];
      const meta = metaResult?.[1] as DriverMeta | null;

      // Filter out stale drivers (metadata expired)
      if (!meta || !meta.vehicleType) {
        staleIds.push(driverId);
        continue;
      }

      // Filter by vehicle type if requested
      if (vehicleType && meta.vehicleType !== vehicleType) continue;

      drivers.push({
        driverId,
        distanceKm: parseFloat(dist),
        lng: parseFloat(coords[0]),
        lat: parseFloat(coords[1]),
        vehicleType: meta.vehicleType,
        rating: parseFloat(meta.rating) || 0,
        fullName: meta.fullName,
        heading: meta.heading ? parseFloat(meta.heading) : null,
      });
    }

    // Lazy cleanup of stale entries
    if (staleIds.length > 0) {
      redisClient.zrem(GEO_KEY, ...staleIds).catch((err: unknown) => {
        logger.warn('RedisGeo: stale cleanup failed', {
          staleIds,
          error: err instanceof Error ? err.message : String(err),
          component: 'redis-geo',
        });
      });
    }

    return drivers;
  } catch (err) {
    logger.warn('RedisGeo: getNearbyDrivers failed', {
      error: err instanceof Error ? err.message : String(err),
      component: 'redis-geo',
    });
    return [];
  }
}

export { getNearbyDrivers, removeDriver, updateDriverLocation };
export type { NearbyDriver };
