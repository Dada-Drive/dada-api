import { RideOffer, Wallet, WalletTransaction } from '@/models/index';
import * as rideService from '@/services/rideService';
import {
  createTestRide,
  createTestRideOffer,
  createTestUser,
  createTestWallet,
  resetFactoryCounters,
} from '@/tests/helpers/factories';
import {
  flushTestRedis,
  setupTestDatabase,
  setupTestRedis,
  teardownTestDatabase,
  teardownTestRedis,
  truncateAllTables,
} from '@/tests/setup';
import { OfferStatus, RideStatus, TransactionType, UserRole, VehicleType } from '@/types/enums';

// Mock job producers — ride expiration enqueue is now part of requestRide/pickDriver/cancelRide
jest.mock('@/jobs/producers', () => ({
  enqueueRideExpiration: jest.fn().mockResolvedValue(undefined),
  enqueueScheduledRideActivation: jest.fn().mockResolvedValue(undefined),
  cancelRideExpiration: jest.fn().mockResolvedValue(undefined),
  cancelScheduledRideActivation: jest.fn().mockResolvedValue(undefined),
  enqueueNotification: jest.fn().mockResolvedValue(undefined),
  enqueueOtpDelivery: jest.fn().mockResolvedValue(undefined),
  enqueuePaymentVerification: jest.fn().mockResolvedValue(undefined),
  enqueueRatingRecalculation: jest.fn().mockResolvedValue(undefined),
}));

beforeAll(async () => {
  await setupTestDatabase();
  await setupTestRedis();
});

afterAll(async () => {
  await teardownTestDatabase();
  await teardownTestRedis();
});

beforeEach(async () => {
  await truncateAllTables();
  await flushTestRedis();
  resetFactoryCounters();
});

describe('Ride Service', () => {
  // ── Full Lifecycle ───────────────────────────────────────────────────────

  describe('full lifecycle', () => {
    it('request → offer → pick → arrive → start → complete', async () => {
      const rider = await createTestUser({ role: UserRole.Rider });
      const driver = await createTestUser({ role: UserRole.Driver });
      await createTestWallet(driver.id, 0);

      // Request
      const ride = await rideService.requestRide(rider.id, {
        vehicleType: VehicleType.Economy,
        pickupLat: 36.8065,
        pickupLng: 10.1815,
        pickupAddress: 'Tunis Centre',
        dropoffLat: 36.8265,
        dropoffLng: 10.2015,
        dropoffAddress: 'La Marsa',
        distanceKm: 5.0,
        estimatedMinutes: 15,
      });
      expect(ride.status).toBe(RideStatus.Pending);

      // Driver offers
      const { ride: offeredRide, offer } = await rideService.acceptRide(ride.id, driver.id);
      expect(offeredRide.status).toBe(RideStatus.Offered);
      expect(offer.driverId).toBe(driver.id);

      // Rider picks driver
      const acceptedRide = await rideService.pickDriver(ride.id, rider.id, offer.id);
      expect(acceptedRide.status).toBe(RideStatus.Accepted);
      expect(acceptedRide.driverId).toBe(driver.id);

      // Driver arrives
      const arrivedRide = await rideService.arriveAtPickup(ride.id, driver.id);
      expect(arrivedRide.arrivedAt).toBeTruthy();

      // Driver starts
      const startedRide = await rideService.startRide(ride.id, driver.id);
      expect(startedRide.status).toBe(RideStatus.InProgress);

      // Driver completes
      const completedRide = await rideService.completeRide(ride.id, driver.id);
      expect(completedRide.status).toBe(RideStatus.Completed);
      expect(Number(completedRide.finalFare)).toBeGreaterThan(0);
      expect(Number(completedRide.commissionAmount)).toBeGreaterThan(0);

      // Verify wallet credited
      const wallet = await Wallet.findOne({ where: { ownerId: driver.id } });
      const expectedEarning =
        Number(completedRide.finalFare) - Number(completedRide.commissionAmount);
      expect(Number(wallet!.balance)).toBe(expectedEarning);

      // Verify transaction records
      const txns = await WalletTransaction.findAll({ where: { walletOwnerId: driver.id } });
      expect(txns).toHaveLength(2);
      expect(txns.map((t) => t.type).sort()).toEqual(
        [TransactionType.Commission, TransactionType.RideEarning].sort(),
      );
    });
  });

  // ── acceptRide (offer creation) ──────────────────────────────────────────

  describe('acceptRide', () => {
    it('5 concurrent acceptRide from different drivers all succeed', async () => {
      const rider = await createTestUser({ role: UserRole.Rider });
      const drivers = [];
      for (let i = 0; i < 5; i++) {
        drivers.push(await createTestUser({ role: UserRole.Driver }));
      }
      const ride = await createTestRide(rider.id);

      const results = await Promise.all(
        drivers.map((d) => rideService.acceptRide(ride.id, d.id).catch((e: unknown) => e)),
      );

      const successes = results.filter(
        (r) => r && typeof r === 'object' && 'ride' in r && 'offer' in r,
      );
      expect(successes.length).toBe(5);

      // All 5 offers created
      const offers = await RideOffer.findAll({ where: { rideId: ride.id } });
      expect(offers).toHaveLength(5);
    });

    it('rejects duplicate offer from same driver', async () => {
      const rider = await createTestUser({ role: UserRole.Rider });
      const driver = await createTestUser({ role: UserRole.Driver });
      const ride = await createTestRide(rider.id);

      await rideService.acceptRide(ride.id, driver.id);
      await expect(rideService.acceptRide(ride.id, driver.id)).rejects.toMatchObject({
        code: 'RIDE_ALREADY_ACCEPTED',
      });
    });

    it('rejects offer on completed ride', async () => {
      const rider = await createTestUser({ role: UserRole.Rider });
      const driver = await createTestUser({ role: UserRole.Driver });
      const ride = await createTestRide(rider.id, { status: RideStatus.Completed });

      await expect(rideService.acceptRide(ride.id, driver.id)).rejects.toMatchObject({
        code: 'RIDE_INVALID_STATUS',
      });
    });
  });

  // ── pickDriver ───────────────────────────────────────────────────────────

  describe('pickDriver', () => {
    it('accepts target offer and rejects others', async () => {
      const rider = await createTestUser({ role: UserRole.Rider });
      const drivers = [];
      for (let i = 0; i < 3; i++) {
        drivers.push(await createTestUser({ role: UserRole.Driver }));
      }
      const ride = await createTestRide(rider.id, { status: RideStatus.Offered });

      // Create 3 pending offers
      const offers = await Promise.all(
        drivers.map((d) => createTestRideOffer(ride.id, d.id, { offeredFare: 12.5 })),
      );

      const result = await rideService.pickDriver(ride.id, rider.id, offers[1]!.id);
      expect(result.status).toBe(RideStatus.Accepted);
      expect(result.driverId).toBe(drivers[1]!.id);

      // Verify offer statuses
      const allOffers = await RideOffer.findAll({ where: { rideId: ride.id } });
      const accepted = allOffers.filter((o) => o.status === OfferStatus.Accepted);
      const rejected = allOffers.filter((o) => o.status === OfferStatus.Rejected);
      expect(accepted).toHaveLength(1);
      expect(rejected).toHaveLength(2);
    });

    it('concurrent pickDriver — exactly one succeeds', async () => {
      const rider = await createTestUser({ role: UserRole.Rider });
      const drivers = [];
      for (let i = 0; i < 3; i++) {
        drivers.push(await createTestUser({ role: UserRole.Driver }));
      }
      const ride = await createTestRide(rider.id, { status: RideStatus.Offered });
      const offers = await Promise.all(
        drivers.map((d) => createTestRideOffer(ride.id, d.id, { offeredFare: 12.5 })),
      );

      const results = await Promise.all(
        offers.map((o) => rideService.pickDriver(ride.id, rider.id, o.id).catch((e: unknown) => e)),
      );

      const successes = results.filter(
        (r) => r && typeof r === 'object' && 'status' in r && r.status === RideStatus.Accepted,
      );
      expect(successes.length).toBe(1);
    });

    it('rejects non-rider from picking driver', async () => {
      const rider = await createTestUser({ role: UserRole.Rider });
      const driver = await createTestUser({ role: UserRole.Driver });
      const other = await createTestUser({ role: UserRole.Rider });
      const ride = await createTestRide(rider.id, { status: RideStatus.Offered });
      const offer = await createTestRideOffer(ride.id, driver.id, { offeredFare: 12.5 });

      await expect(rideService.pickDriver(ride.id, other.id, offer.id)).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });
  });

  // ── Cancellation ─────────────────────────────────────────────────────────

  describe('cancelRide', () => {
    it.each([RideStatus.Pending, RideStatus.Offered, RideStatus.Accepted, RideStatus.InProgress])(
      'can cancel from %s',
      async (status) => {
        const rider = await createTestUser({ role: UserRole.Rider });
        const driver = await createTestUser({ role: UserRole.Driver });
        const ride = await createTestRide(rider.id, {
          status,
          driverId: status === RideStatus.Pending ? null : driver.id,
        });

        const cancelled = await rideService.cancelRide(ride.id, rider.id, 'test reason');
        expect(cancelled.status).toBe(RideStatus.Cancelled);
        expect(cancelled.cancelledBy).toBe('rider');
      },
    );

    it.each([RideStatus.Completed, RideStatus.Cancelled])(
      'cannot cancel from %s',
      async (status) => {
        const rider = await createTestUser({ role: UserRole.Rider });
        const ride = await createTestRide(rider.id, { status });

        await expect(rideService.cancelRide(ride.id, rider.id)).rejects.toMatchObject({
          code: 'RIDE_INVALID_STATUS',
        });
      },
    );

    it('records driver as canceller', async () => {
      const rider = await createTestUser({ role: UserRole.Rider });
      const driver = await createTestUser({ role: UserRole.Driver });
      const ride = await createTestRide(rider.id, {
        status: RideStatus.Accepted,
        driverId: driver.id,
      });

      const cancelled = await rideService.cancelRide(ride.id, driver.id, 'emergency');
      expect(cancelled.cancelledBy).toBe('driver');
      expect(cancelled.cancelReason).toBe('emergency');
    });
  });

  // ── completeRide ─────────────────────────────────────────────────────────

  describe('completeRide', () => {
    it('calculates fare, commission, and credits wallet', async () => {
      const rider = await createTestUser({ role: UserRole.Rider });
      const driver = await createTestUser({ role: UserRole.Driver });
      await createTestWallet(driver.id, 0);

      const ride = await createTestRide(rider.id, {
        status: RideStatus.InProgress,
        driverId: driver.id,
        calculatedFare: 20,
      });

      const completed = await rideService.completeRide(ride.id, driver.id);
      expect(Number(completed.finalFare)).toBe(20);
      expect(Number(completed.commissionAmount)).toBe(2);

      const wallet = await Wallet.findOne({ where: { ownerId: driver.id } });
      expect(Number(wallet!.balance)).toBe(18);

      const txns = await WalletTransaction.findAll({ where: { walletOwnerId: driver.id } });
      const earning = txns.find((t) => t.type === TransactionType.RideEarning);
      const commission = txns.find((t) => t.type === TransactionType.Commission);
      expect(Number(earning!.amount)).toBe(18);
      expect(Number(commission!.amount)).toBe(2);
    });

    it('rejects completion of non-in-progress ride', async () => {
      const rider = await createTestUser({ role: UserRole.Rider });
      const driver = await createTestUser({ role: UserRole.Driver });
      const ride = await createTestRide(rider.id, {
        status: RideStatus.Accepted,
        driverId: driver.id,
      });

      await expect(rideService.completeRide(ride.id, driver.id)).rejects.toMatchObject({
        code: 'RIDE_INVALID_STATUS',
      });
    });
  });

  // ── Fare calculation ─────────────────────────────────────────────────────

  describe('calculateFare', () => {
    it('applies MIN_FARE floor', async () => {
      const result = await rideService.calculateFare({
        vehicleType: VehicleType.Economy,
        distanceKm: 0.1,
        estimatedMinutes: 1,
      });
      expect(result.fare).toBeGreaterThanOrEqual(3.0);
    });
  });
});
