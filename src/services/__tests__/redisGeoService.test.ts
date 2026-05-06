import { redisClient } from '@/config/redis';
import { getNearbyDrivers, removeDriver, updateDriverLocation } from '@/services/redisGeoService';
import { flushTestRedis, setupTestRedis, teardownTestRedis } from '@/tests/setup';
import { VehicleType } from '@/types/enums';

beforeAll(async () => {
  await setupTestRedis();
});

afterAll(async () => {
  await teardownTestRedis();
});

beforeEach(async () => {
  await flushTestRedis();
});

// Tunis area coordinates for realistic test data
const TUNIS_CENTER = { lat: 36.8065, lng: 10.1815 };

function offsetCoords(
  base: { lat: number; lng: number },
  latOffsetKm: number,
  lngOffsetKm: number,
): { lat: number; lng: number } {
  return {
    lat: base.lat + latOffsetKm / 111,
    lng: base.lng + lngOffsetKm / (111 * Math.cos((base.lat * Math.PI) / 180)),
  };
}

describe('Redis Geo Service', () => {
  // ── updateDriverLocation ────────────────────────────────────────────────

  describe('updateDriverLocation', () => {
    it('adds driver to geo index and stores metadata', async () => {
      await updateDriverLocation('driver-1', TUNIS_CENTER.lat, TUNIS_CENTER.lng, {
        vehicleType: VehicleType.Economy,
        rating: 4.5,
        fullName: 'Ahmed Ben Ali',
      });

      // Verify geo index
      const members = await redisClient.zrange('drivers:online', 0, -1);
      expect(members).toContain('driver-1');

      // Verify metadata
      const meta = await redisClient.hgetall('driver:driver-1:meta');
      expect(meta.vehicleType).toBe('economy');
      expect(meta.rating).toBe('4.5');
      expect(meta.fullName).toBe('Ahmed Ben Ali');

      // Verify TTL is set on metadata
      const ttl = await redisClient.ttl('driver:driver-1:meta');
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(120);
    });

    it('refreshes metadata TTL on subsequent calls', async () => {
      await updateDriverLocation('driver-1', TUNIS_CENTER.lat, TUNIS_CENTER.lng, {
        vehicleType: VehicleType.Economy,
        rating: 4.0,
        fullName: 'Driver One',
      });

      // Wait a moment then update again
      await new Promise((r) => setTimeout(r, 200));

      await updateDriverLocation('driver-1', TUNIS_CENTER.lat + 0.001, TUNIS_CENTER.lng, {
        vehicleType: VehicleType.Economy,
        rating: 4.0,
        fullName: 'Driver One',
      });

      const ttl = await redisClient.ttl('driver:driver-1:meta');
      expect(ttl).toBeGreaterThan(118); // Should be near 120 after refresh
    });
  });

  // ── removeDriver ──────────────────────────────────────────────────────

  describe('removeDriver', () => {
    it('removes driver from geo index and deletes metadata', async () => {
      await updateDriverLocation('driver-1', TUNIS_CENTER.lat, TUNIS_CENTER.lng, {
        vehicleType: VehicleType.Economy,
        rating: 4.5,
        fullName: 'Driver One',
      });

      await removeDriver('driver-1');

      const members = await redisClient.zrange('drivers:online', 0, -1);
      expect(members).not.toContain('driver-1');

      const meta = await redisClient.hgetall('driver:driver-1:meta');
      expect(Object.keys(meta)).toHaveLength(0);
    });

    it('does not throw for non-existent driver', async () => {
      await expect(removeDriver('nonexistent')).resolves.toBeUndefined();
    });
  });

  // ── getNearbyDrivers ──────────────────────────────────────────────────

  describe('getNearbyDrivers', () => {
    it('returns drivers within radius sorted by distance', async () => {
      // Place 3 drivers at different distances from center
      const close = offsetCoords(TUNIS_CENTER, 1, 0); // ~1km
      const mid = offsetCoords(TUNIS_CENTER, 3, 0); // ~3km
      const far = offsetCoords(TUNIS_CENTER, 8, 0); // ~8km (outside 5km radius)

      await updateDriverLocation('close', close.lat, close.lng, {
        vehicleType: VehicleType.Economy,
        rating: 4.5,
        fullName: 'Close Driver',
      });
      await updateDriverLocation('mid', mid.lat, mid.lng, {
        vehicleType: VehicleType.Economy,
        rating: 4.0,
        fullName: 'Mid Driver',
      });
      await updateDriverLocation('far', far.lat, far.lng, {
        vehicleType: VehicleType.Economy,
        rating: 3.5,
        fullName: 'Far Driver',
      });

      const results = await getNearbyDrivers(TUNIS_CENTER.lat, TUNIS_CENTER.lng, 5);

      expect(results).toHaveLength(2); // close + mid, not far
      expect(results[0]!.driverId).toBe('close');
      expect(results[1]!.driverId).toBe('mid');
      expect(results[0]!.distanceKm).toBeLessThan(results[1]!.distanceKm);
    });

    it('filters by vehicle type', async () => {
      await updateDriverLocation('eco-1', TUNIS_CENTER.lat, TUNIS_CENTER.lng, {
        vehicleType: VehicleType.Economy,
        rating: 4.0,
        fullName: 'Economy Driver',
      });
      await updateDriverLocation('prem-1', TUNIS_CENTER.lat + 0.001, TUNIS_CENTER.lng, {
        vehicleType: VehicleType.Premium,
        rating: 4.5,
        fullName: 'Premium Driver',
      });

      const economy = await getNearbyDrivers(
        TUNIS_CENTER.lat,
        TUNIS_CENTER.lng,
        5,
        VehicleType.Economy,
      );
      expect(economy).toHaveLength(1);
      expect(economy[0]!.vehicleType).toBe('economy');

      const premium = await getNearbyDrivers(
        TUNIS_CENTER.lat,
        TUNIS_CENTER.lng,
        5,
        VehicleType.Premium,
      );
      expect(premium).toHaveLength(1);
      expect(premium[0]!.vehicleType).toBe('premium');
    });

    it('returns all types when no filter specified', async () => {
      await updateDriverLocation('eco', TUNIS_CENTER.lat, TUNIS_CENTER.lng, {
        vehicleType: VehicleType.Economy,
        rating: 4.0,
        fullName: 'Economy',
      });
      await updateDriverLocation('prem', TUNIS_CENTER.lat + 0.001, TUNIS_CENTER.lng, {
        vehicleType: VehicleType.Premium,
        rating: 4.5,
        fullName: 'Premium',
      });
      await updateDriverLocation('van', TUNIS_CENTER.lat + 0.002, TUNIS_CENTER.lng, {
        vehicleType: VehicleType.Van,
        rating: 4.2,
        fullName: 'Van',
      });

      const all = await getNearbyDrivers(TUNIS_CENTER.lat, TUNIS_CENTER.lng, 5);
      expect(all).toHaveLength(3);
    });

    it('returns empty array when no drivers in radius', async () => {
      const farAway = offsetCoords(TUNIS_CENTER, 100, 0);
      await updateDriverLocation('far', farAway.lat, farAway.lng, {
        vehicleType: VehicleType.Economy,
        rating: 4.0,
        fullName: 'Far Away',
      });

      const results = await getNearbyDrivers(TUNIS_CENTER.lat, TUNIS_CENTER.lng, 5);
      expect(results).toHaveLength(0);
    });

    it('filters out stale drivers with expired metadata', async () => {
      await updateDriverLocation('active', TUNIS_CENTER.lat, TUNIS_CENTER.lng, {
        vehicleType: VehicleType.Economy,
        rating: 4.5,
        fullName: 'Active',
      });

      // Add driver to geo index but manually delete metadata (simulates expiry)
      await redisClient.geoadd(
        'drivers:online',
        TUNIS_CENTER.lng,
        TUNIS_CENTER.lat + 0.001,
        'stale',
      );

      const results = await getNearbyDrivers(TUNIS_CENTER.lat, TUNIS_CENTER.lng, 5);
      expect(results).toHaveLength(1);
      expect(results[0]!.driverId).toBe('active');
    });

    it('lazily removes stale entries from geo set', async () => {
      // Add a stale entry (in geo set but no metadata)
      await redisClient.geoadd('drivers:online', TUNIS_CENTER.lng, TUNIS_CENTER.lat, 'stale');

      await getNearbyDrivers(TUNIS_CENTER.lat, TUNIS_CENTER.lng, 5);

      // Give lazy cleanup a moment
      await new Promise((r) => setTimeout(r, 100));

      const members = await redisClient.zrange('drivers:online', 0, -1);
      expect(members).not.toContain('stale');
    });

    it('handles 100 drivers and returns sorted by distance', async () => {
      // Add 100 drivers at varying distances (0.1km to 10km)
      for (let i = 0; i < 100; i++) {
        const distKm = 0.1 + (i * 10) / 100;
        const coords = offsetCoords(TUNIS_CENTER, distKm, 0);
        await updateDriverLocation(`driver-${String(i)}`, coords.lat, coords.lng, {
          vehicleType:
            i % 3 === 0 ? VehicleType.Economy : i % 3 === 1 ? VehicleType.Premium : VehicleType.Van,
          rating: 3.0 + (i % 20) / 10,
          fullName: `Driver ${String(i)}`,
        });
      }

      const within5km = await getNearbyDrivers(TUNIS_CENTER.lat, TUNIS_CENTER.lng, 5);
      expect(within5km.length).toBeGreaterThan(0);
      expect(within5km.length).toBeLessThan(100); // Some should be outside 5km

      // Verify sorted by distance
      for (let i = 1; i < within5km.length; i++) {
        expect(within5km[i]!.distanceKm).toBeGreaterThanOrEqual(within5km[i - 1]!.distanceKm);
      }
    });

    it('returns correct coordinate and metadata fields', async () => {
      await updateDriverLocation('driver-1', 36.8065, 10.1815, {
        vehicleType: VehicleType.Premium,
        rating: 4.8,
        fullName: 'Test Driver',
      });

      const results = await getNearbyDrivers(36.8065, 10.1815, 1);
      expect(results).toHaveLength(1);

      const driver = results[0]!;
      expect(driver.driverId).toBe('driver-1');
      expect(driver.vehicleType).toBe('premium');
      expect(driver.rating).toBe(4.8);
      expect(driver.fullName).toBe('Test Driver');
      expect(driver.lat).toBeCloseTo(36.8065, 3);
      expect(driver.lng).toBeCloseTo(10.1815, 3);
      expect(driver.distanceKm).toBeDefined();
    });
  });
});
