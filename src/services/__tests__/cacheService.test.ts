import { redisClient } from '@/config/redis';
import { cacheDel, cacheDelPattern, cacheGet, cacheSet } from '@/services/cacheService';
import { flushTestRedis, setupTestRedis, teardownTestRedis } from '@/tests/setup';

beforeAll(async () => {
  await setupTestRedis();
});

afterAll(async () => {
  await teardownTestRedis();
});

beforeEach(async () => {
  await flushTestRedis();
});

describe('Cache Service', () => {
  describe('cacheGet / cacheSet', () => {
    it('round-trips JSON data correctly', async () => {
      const data = { name: 'Alice', score: 42, tags: ['a', 'b'] };
      await cacheSet('test:roundtrip', data, 60);

      const result = await cacheGet<typeof data>('test:roundtrip');
      expect(result).toEqual(data);
    });

    it('returns null for cache miss', async () => {
      const result = await cacheGet('test:nonexistent');
      expect(result).toBeNull();
    });

    it('respects TTL expiry', async () => {
      await cacheSet('test:ttl', { value: 1 }, 1);

      const before = await cacheGet('test:ttl');
      expect(before).toEqual({ value: 1 });

      // Wait for TTL to expire
      await new Promise((r) => setTimeout(r, 1500));

      const after = await cacheGet('test:ttl');
      expect(after).toBeNull();
    });
  });

  describe('cacheDel', () => {
    it('removes a cached entry', async () => {
      await cacheSet('test:del', { x: 1 }, 60);
      await cacheDel('test:del');

      const result = await cacheGet('test:del');
      expect(result).toBeNull();
    });

    it('does not throw on non-existent key', async () => {
      await expect(cacheDel('test:noop')).resolves.toBeUndefined();
    });
  });

  describe('cacheDelPattern', () => {
    it('removes all keys matching pattern', async () => {
      await Promise.all([
        cacheSet('prefix:a', 1, 60),
        cacheSet('prefix:b', 2, 60),
        cacheSet('prefix:c', 3, 60),
        cacheSet('other:d', 4, 60),
      ]);

      await cacheDelPattern('prefix:*');

      expect(await cacheGet('prefix:a')).toBeNull();
      expect(await cacheGet('prefix:b')).toBeNull();
      expect(await cacheGet('prefix:c')).toBeNull();
      expect(await cacheGet('other:d')).toEqual(4);
    });

    it('handles no matching keys gracefully', async () => {
      await expect(cacheDelPattern('nonexistent:*')).resolves.toBeUndefined();
    });
  });

  describe('fail-open behavior', () => {
    it('cacheGet returns null on invalid JSON', async () => {
      // Manually set invalid JSON
      await redisClient.set('test:badjson', '{invalid');
      const result = await cacheGet('test:badjson');
      expect(result).toBeNull();
    });
  });
});
