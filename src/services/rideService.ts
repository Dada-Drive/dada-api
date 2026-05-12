import { Op, QueryTypes, Transaction } from 'sequelize';

import { FARE_CONFIG } from '@/config/fareConfig';
import { config } from '@/config/index';
import {
  cancelRideExpiration,
  enqueueRideExpiration,
  enqueueScheduledRideActivation,
} from '@/jobs/producers';
import {
  DriverProfile,
  Ride,
  RideOffer,
  sequelize,
  User,
  Vehicle,
  Wallet,
  WalletTransaction,
} from '@/models/index';
import { cacheGet, cacheSet } from '@/services/cacheService';
import * as notificationService from '@/services/notificationService';
import {
  emitToNearbyDrivers,
  emitToRideRoom,
  emitToUser,
  joinRideRoom,
  leaveRideRoom,
} from '@/sockets/emitter';
import {
  NotificationType,
  OfferStatus,
  RideStatus,
  TransactionStatus,
  TransactionType,
  VehicleType,
  WalletStatus,
} from '@/types/enums';
import { ErrorCodes, appError } from '@/types/errorCodes';
import { validateTransition } from '@/types/rideStateMachine';
import { parseFilters, parseSorting } from '@/utils/filtering';
import { buildPaginationMeta, parsePaginationQuery } from '@/utils/pagination';

import type { PaginationMeta } from '@/types/pagination';

// ── Types ───────────────────────────────────────────────────────────────────

interface FareEstimateInput {
  vehicleType: VehicleType;
  distanceKm: number;
  estimatedMinutes: number;
}

interface CreateRideInput {
  vehicleType: VehicleType;
  pickupLat: number;
  pickupLng: number;
  pickupAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  dropoffAddress: string;
  distanceKm: number;
  estimatedMinutes: number;
  passengerName?: string;
  passengerPhone?: string;
  isShared?: boolean;
  sharedSeatsAvailable?: number;
  scheduledAt?: string;
}

// ── Fare Calculation ────────────────────────────────────────────────────────

const FARE_CACHE_TTL = 3600; // 1 hour

async function calculateFare(
  input: FareEstimateInput,
): Promise<{ fare: number; currency: string }> {
  // Bucketed cache key: round distance to nearest 0.5km, minutes to nearest 1min
  const distBucket = Math.round(input.distanceKm * 2) / 2;
  const minBucket = Math.round(input.estimatedMinutes);
  const cacheKey = `fare:${input.vehicleType}:${String(distBucket)}:${String(minBucket)}`;

  const cached = await cacheGet<{ fare: number; currency: string }>(cacheKey);
  if (cached) return cached;

  const { fare: fareConfig } = config;
  const type = input.vehicleType;

  const baseFare = fareConfig.baseFare[type];
  const distanceCost = input.distanceKm * fareConfig.perKm[type];
  const timeCost = input.estimatedMinutes * fareConfig.perMin[type];
  const raw = Math.round((baseFare + distanceCost + timeCost) * 100) / 100;
  const fare = Math.max(raw, FARE_CONFIG.MIN_FARE);
  const result = { fare, currency: fareConfig.currency };

  await cacheSet(cacheKey, result, FARE_CACHE_TTL);
  return result;
}

// ── Request Ride ────────────────────────────────────────────────────────────

async function requestRide(riderId: string, input: CreateRideInput): Promise<Ride> {
  const { fare } = await calculateFare({
    vehicleType: input.vehicleType,
    distanceKm: input.distanceKm,
    estimatedMinutes: input.estimatedMinutes,
  });

  const ride = await Ride.create({
    riderId,
    vehicleType: input.vehicleType,
    pickupLat: input.pickupLat,
    pickupLng: input.pickupLng,
    pickupAddress: input.pickupAddress,
    dropoffLat: input.dropoffLat,
    dropoffLng: input.dropoffLng,
    dropoffAddress: input.dropoffAddress,
    distanceKm: input.distanceKm,
    estimatedMinutes: input.estimatedMinutes,
    calculatedFare: fare,
    commissionRate: FARE_CONFIG.COMMISSION_RATE,
    passengerName: input.passengerName,
    passengerPhone: input.passengerPhone,
    isShared: input.isShared,
    sharedSeatsAvailable: input.sharedSeatsAvailable,
    scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min expiry
  });

  void emitToNearbyDrivers(
    ride.pickupLat,
    ride.pickupLng,
    config.socket.rideSearchRadiusKm,
    'ride:new_request',
    {
      rideId: ride.id,
      pickupLat: ride.pickupLat,
      pickupLng: ride.pickupLng,
      pickupAddress: ride.pickupAddress,
      dropoffAddress: ride.dropoffAddress,
      vehicleType: ride.vehicleType,
      calculatedFare: Number(ride.calculatedFare),
      riderName: input.passengerName ?? '',
    },
    ride.vehicleType as VehicleType,
  );

  // Enqueue ride expiration (fires after expiresAt)
  void enqueueRideExpiration({ rideId: ride.id, riderId }, 5 * 60 * 1000);

  // If scheduled, also enqueue activation 15 min before scheduledAt
  if (ride.scheduledAt) {
    const activationDelay = ride.scheduledAt.getTime() - 15 * 60 * 1000 - Date.now();
    void enqueueScheduledRideActivation(
      { rideId: ride.id, riderId, scheduledAt: ride.scheduledAt.toISOString() },
      activationDelay,
    );
  }

  return ride;
}

// ── Get My Rides ────────────────────────────────────────────────────────────

async function getMyRides(
  userId: string,
  query: Record<string, unknown>,
): Promise<{ rows: Ride[]; meta: PaginationMeta }> {
  const { offset, limit, page } = parsePaginationQuery(query);
  const where = {
    ...parseFilters(query, ['status', 'vehicleType']),
    [Op.or]: [{ riderId: userId }, { driverId: userId }],
  };
  const order = parseSorting(query.sort, ['createdAt', 'status', 'calculatedFare']);

  const { rows, count } = await Ride.findAndCountAll({
    where,
    order,
    offset,
    limit,
    include: [
      { model: User, as: 'rider', attributes: ['id', 'fullName', 'avatarUrl'] },
      { model: User, as: 'driver', attributes: ['id', 'fullName', 'avatarUrl'] },
    ],
  });

  return { rows, meta: buildPaginationMeta(count, page, limit) };
}

// ── Get Available Rides (for drivers) ───────────────────────────────────────

async function getAvailableRides(
  query: Record<string, unknown>,
): Promise<{ rows: Ride[]; meta: PaginationMeta }> {
  const { offset, limit, page } = parsePaginationQuery(query);
  const where = {
    status: { [Op.in]: [RideStatus.Pending, RideStatus.Offered] },
    ...(query.vehicleType ? { vehicleType: query.vehicleType } : {}),
  };

  const { rows, count } = await Ride.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    offset,
    limit,
    include: [{ model: User, as: 'rider', attributes: ['id', 'fullName', 'avatarUrl'] }],
  });

  return { rows, meta: buildPaginationMeta(count, page, limit) };
}

// ── Get Scheduled Rides ─────────────────────────────────────────────────────

async function getScheduledRides(
  userId: string,
  query: Record<string, unknown>,
): Promise<{ rows: Ride[]; meta: PaginationMeta }> {
  const { offset, limit, page } = parsePaginationQuery(query);

  const { rows, count } = await Ride.findAndCountAll({
    where: {
      riderId: userId,
      scheduledAt: { [Op.not]: null },
      status: { [Op.in]: [RideStatus.Pending, RideStatus.Offered, RideStatus.Accepted] },
    },
    order: [['scheduledAt', 'ASC']],
    offset,
    limit,
  });

  return { rows, meta: buildPaginationMeta(count, page, limit) };
}

// ── Get Ride Details ────────────────────────────────────────────────────────

async function getRideDetails(rideId: string, userId: string): Promise<Ride> {
  const ride = await Ride.findByPk(rideId, {
    include: [
      { model: User, as: 'rider', attributes: ['id', 'fullName', 'avatarUrl', 'phone'] },
      { model: User, as: 'driver', attributes: ['id', 'fullName', 'avatarUrl', 'phone'] },
    ],
  });
  if (!ride) throw appError(ErrorCodes.RIDE.RIDE_NOT_FOUND);
  if (ride.riderId !== userId && ride.driverId !== userId) {
    throw appError(ErrorCodes.AUTH.FORBIDDEN);
  }
  return ride;
}

// ── Get Ride Offers ─────────────────────────────────────────────────────────

async function getRideOffers(rideId: string, userId: string): Promise<RideOffer[]> {
  const ride = await Ride.findByPk(rideId);
  if (!ride) throw appError(ErrorCodes.RIDE.RIDE_NOT_FOUND);
  if (ride.riderId !== userId) throw appError(ErrorCodes.AUTH.FORBIDDEN);

  return RideOffer.findAll({
    where: { rideId },
    include: [{ model: User, as: 'driver', attributes: ['id', 'fullName', 'avatarUrl'] }],
    order: [['createdAt', 'DESC']],
    limit: 100,
  });
}

// ── Ride Lifecycle ─────────────────────────────────────────────────────────

async function acceptRide(
  rideId: string,
  driverId: string,
): Promise<{ ride: Ride; offer: RideOffer }> {
  const result = await sequelize.transaction(
    { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
    async (t) => {
      const ride = await Ride.findByPk(rideId, { lock: t.LOCK.UPDATE, transaction: t });
      if (!ride) throw appError(ErrorCodes.RIDE.RIDE_NOT_FOUND);

      if (ride.status !== RideStatus.Pending && ride.status !== RideStatus.Offered) {
        throw appError(ErrorCodes.RIDE.RIDE_INVALID_STATUS);
      }

      const existing = await RideOffer.findOne({
        where: { rideId, driverId },
        transaction: t,
      });
      if (existing) throw appError(ErrorCodes.RIDE.RIDE_ALREADY_ACCEPTED);

      const offer = await RideOffer.create(
        { rideId, driverId, offeredFare: Number(ride.calculatedFare) },
        { transaction: t },
      );

      if (ride.status === RideStatus.Pending) {
        validateTransition(ride.status, RideStatus.Offered);
        ride.status = RideStatus.Offered;
        await ride.save({ transaction: t });
      }

      return { ride, offer };
    },
  );

  // Fetch driver profile for offer payload
  const driverProfile = await DriverProfile.findOne({
    where: { userId: driverId },
    include: [
      { model: User, as: 'user', attributes: ['fullName'] },
      { model: Vehicle, as: 'vehicle', attributes: ['make', 'model', 'plateNumber', 'color'] },
    ],
  });

  const driverName = driverProfile?.user?.fullName ?? '';
  const driverRating = driverProfile?.rating ? Number(driverProfile.rating) : 0;
  const vehicle = driverProfile?.vehicle;
  const vehicleInfo = vehicle ? `${vehicle.make} ${vehicle.model} — ${vehicle.plateNumber}` : '';

  emitToUser(result.ride.riderId, 'ride:new_offer', {
    rideId: result.ride.id,
    offerId: result.offer.id,
    driverId,
    driverName,
    driverRating,
    vehicleType: vehicleInfo || result.ride.vehicleType,
    offeredFare: Number(result.offer.offeredFare),
  });

  void notificationService.send(result.ride.riderId, {
    type: NotificationType.RideOffer,
    title: 'New ride offer',
    body: `A driver offered ${String(Number(result.offer.offeredFare))} TND for your ride`,
    data: { rideId: result.ride.id, offerId: result.offer.id },
  });

  return result;
}

// ── Pick Driver ────────────────────────────────────────────────────────────

async function pickDriver(rideId: string, riderId: string, offerId: string): Promise<Ride> {
  const { ride, rejectedDriverIds } = await sequelize.transaction(
    { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
    async (t) => {
      const r = await Ride.findByPk(rideId, { lock: t.LOCK.UPDATE, transaction: t });
      if (!r) throw appError(ErrorCodes.RIDE.RIDE_NOT_FOUND);
      if (r.riderId !== riderId) throw appError(ErrorCodes.AUTH.FORBIDDEN);

      validateTransition(r.status, RideStatus.Accepted);

      const offer = await RideOffer.findOne({
        where: { id: offerId, rideId, status: OfferStatus.Pending },
        transaction: t,
      });
      if (!offer) throw appError(ErrorCodes.RIDE.OFFER_NOT_FOUND);

      offer.status = OfferStatus.Accepted;
      await offer.save({ transaction: t });

      // Get rejected driver IDs before rejecting
      const rejected = await RideOffer.findAll({
        where: { rideId, id: { [Op.ne]: offerId }, status: OfferStatus.Pending },
        attributes: ['id', 'driverId'],
        transaction: t,
      });

      await RideOffer.update(
        { status: OfferStatus.Rejected },
        {
          where: { rideId, id: { [Op.ne]: offerId }, status: OfferStatus.Pending },
          transaction: t,
        },
      );

      r.driverId = offer.driverId;
      r.status = RideStatus.Accepted;
      await r.save({ transaction: t });
      return {
        ride: r,
        rejectedDriverIds: rejected.map((o) => ({ id: o.id, driverId: o.driverId })),
      };
    },
  );

  // Cancel the ride expiration delayed job (ride is now accepted)
  void cancelRideExpiration(rideId);

  // Join ride room for both participants
  void joinRideRoom(riderId, rideId);
  void joinRideRoom(ride.driverId!, rideId);

  emitToUser(ride.driverId!, 'ride:accepted', {
    rideId: ride.id,
    riderId,
    riderName: '',
    pickupLat: ride.pickupLat,
    pickupLng: ride.pickupLng,
    pickupAddress: ride.pickupAddress,
    dropoffAddress: ride.dropoffAddress,
  });

  void notificationService.send(ride.driverId!, {
    type: NotificationType.RideAccepted,
    title: 'Ride accepted',
    body: `You have been selected for a ride to ${ride.dropoffAddress}`,
    data: { rideId: ride.id },
  });

  for (const rejected of rejectedDriverIds) {
    emitToUser(rejected.driverId, 'ride:offer_rejected', {
      rideId: ride.id,
      offerId: rejected.id,
    });

    void notificationService.send(rejected.driverId, {
      type: NotificationType.RideOfferRejected,
      title: 'Offer not selected',
      body: 'The rider chose another driver for this ride',
      data: { rideId: ride.id },
    });
  }

  return ride;
}

// ── Refuse Ride ────────────────────────────────────────────────────────────

async function refuseRide(rideId: string, driverId: string): Promise<void> {
  const { riderId, offerId } = await sequelize.transaction(
    { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
    async (t) => {
      const offer = await RideOffer.findOne({
        where: { rideId, driverId, status: OfferStatus.Pending },
        transaction: t,
      });
      if (!offer) throw appError(ErrorCodes.RIDE.OFFER_NOT_FOUND);

      const ride = await Ride.findByPk(rideId, { attributes: ['riderId'], transaction: t });
      if (!ride) throw appError(ErrorCodes.RIDE.RIDE_NOT_FOUND);

      offer.status = OfferStatus.Rejected;
      await offer.save({ transaction: t });

      return { riderId: ride.riderId, offerId: offer.id };
    },
  );

  emitToUser(riderId, 'ride:offer_rejected', { rideId, offerId });
}

async function arriveAtPickup(rideId: string, driverId: string): Promise<Ride> {
  const ride = await sequelize.transaction(
    { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
    async (t) => {
      const r = await Ride.findByPk(rideId, { lock: t.LOCK.UPDATE, transaction: t });
      if (!r) throw appError(ErrorCodes.RIDE.RIDE_NOT_FOUND);
      if (r.driverId !== driverId) throw appError(ErrorCodes.AUTH.FORBIDDEN);
      if (r.status !== RideStatus.Accepted) throw appError(ErrorCodes.RIDE.RIDE_INVALID_STATUS);

      r.arrivedAt = new Date();
      await r.save({ transaction: t });
      return r;
    },
  );

  emitToUser(ride.riderId, 'ride:driver_arrived', {
    rideId: ride.id,
    arrivedAt: ride.arrivedAt!.toISOString(),
  });

  void notificationService.send(ride.riderId, {
    type: NotificationType.DriverArrived,
    title: 'Driver arrived',
    body: 'Your driver has arrived at the pickup location',
    data: { rideId: ride.id },
  });

  return ride;
}

async function startRide(rideId: string, driverId: string): Promise<Ride> {
  const ride = await sequelize.transaction(
    { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
    async (t) => {
      const r = await Ride.findByPk(rideId, { lock: t.LOCK.UPDATE, transaction: t });
      if (!r) throw appError(ErrorCodes.RIDE.RIDE_NOT_FOUND);
      if (r.driverId !== driverId) throw appError(ErrorCodes.AUTH.FORBIDDEN);
      validateTransition(r.status, RideStatus.InProgress);

      r.status = RideStatus.InProgress;
      r.startedAt = new Date();
      await r.save({ transaction: t });
      return r;
    },
  );

  emitToRideRoom(ride.id, 'ride:status_changed', {
    rideId: ride.id,
    status: ride.status,
    timestamp: ride.startedAt!.toISOString(),
  });

  void notificationService.send(ride.riderId, {
    type: NotificationType.RideStarted,
    title: 'Ride started',
    body: 'Your ride is now in progress',
    data: { rideId: ride.id },
  });

  return ride;
}

async function completeRide(rideId: string, driverId: string): Promise<Ride> {
  const ride = await sequelize.transaction(
    { isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE },
    async (t) => {
      const r = await Ride.findByPk(rideId, { lock: t.LOCK.UPDATE, transaction: t });
      if (!r) throw appError(ErrorCodes.RIDE.RIDE_NOT_FOUND);
      if (r.driverId !== driverId) throw appError(ErrorCodes.AUTH.FORBIDDEN);
      validateTransition(r.status, RideStatus.Completed);

      const finalFare = Number(r.calculatedFare);
      const commissionAmount = Math.round(finalFare * (Number(r.commissionRate) / 100) * 100) / 100;
      const driverEarning = Math.round((finalFare - commissionAmount) * 100) / 100;

      const wallet = await Wallet.findOne({
        where: { ownerId: driverId },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });
      if (!wallet)
        throw appError(ErrorCodes.GENERAL.NOT_FOUND, { message: 'Driver wallet not found' });
      if (wallet.status !== WalletStatus.Active) throw appError(ErrorCodes.WALLET.WALLET_SUSPENDED);

      const results = await sequelize.query(
        'UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE owner_id = $2 AND balance + $1 >= 0 RETURNING *',
        { bind: [driverEarning, driverId], transaction: t, type: QueryTypes.SELECT },
      );
      if (results.length === 0) {
        throw appError(ErrorCodes.WALLET.INSUFFICIENT_BALANCE);
      }

      await WalletTransaction.bulkCreate(
        [
          {
            walletOwnerId: driverId,
            type: TransactionType.RideEarning,
            amount: driverEarning,
            status: TransactionStatus.Completed,
            referenceId: `${rideId}:earning`,
            description: 'Ride earning',
          },
          {
            walletOwnerId: driverId,
            type: TransactionType.Commission,
            amount: commissionAmount,
            status: TransactionStatus.Completed,
            referenceId: `${rideId}:commission`,
            description: 'Platform commission',
          },
        ],
        { transaction: t },
      );

      r.status = RideStatus.Completed;
      r.finalFare = finalFare;
      r.commissionAmount = commissionAmount;
      r.completedAt = new Date();
      await r.save({ transaction: t });
      return r;
    },
  );

  emitToUser(ride.riderId, 'ride:completed', {
    rideId: ride.id,
    status: ride.status,
    finalFare: Number(ride.finalFare),
    completedAt: ride.completedAt!.toISOString(),
  });
  emitToUser(driverId, 'ride:completed', {
    rideId: ride.id,
    status: ride.status,
    finalFare: Number(ride.finalFare),
    commissionAmount: Number(ride.commissionAmount),
    completedAt: ride.completedAt!.toISOString(),
  });
  void leaveRideRoom(ride.riderId, ride.id);
  void leaveRideRoom(driverId, ride.id);

  void notificationService.send(ride.riderId, {
    type: NotificationType.RideCompleted,
    title: 'Ride completed',
    body: `Your ride has been completed. Fare: ${String(Number(ride.finalFare))} TND`,
    data: { rideId: ride.id },
  });
  void notificationService.send(driverId, {
    type: NotificationType.RideCompleted,
    title: 'Ride completed',
    body: `Ride completed. Earning credited to your wallet`,
    data: { rideId: ride.id },
  });

  return ride;
}

async function cancelRide(rideId: string, userId: string, reason?: string): Promise<Ride> {
  const ride = await sequelize.transaction(
    { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
    async (t) => {
      const r = await Ride.findByPk(rideId, { lock: t.LOCK.UPDATE, transaction: t });
      if (!r) throw appError(ErrorCodes.RIDE.RIDE_NOT_FOUND);
      if (r.riderId !== userId && r.driverId !== userId) {
        throw appError(ErrorCodes.AUTH.FORBIDDEN);
      }
      validateTransition(r.status, RideStatus.Cancelled);

      r.status = RideStatus.Cancelled;
      r.cancelledBy = userId === r.riderId ? 'rider' : 'driver';
      r.cancelReason = reason || null;
      await r.save({ transaction: t });
      return r;
    },
  );

  // Cancel pending expiration job
  void cancelRideExpiration(ride.id);

  emitToRideRoom(ride.id, 'ride:cancelled', {
    rideId: ride.id,
    cancelledBy: ride.cancelledBy ?? 'rider',
    cancelReason: ride.cancelReason ?? null,
  });
  void leaveRideRoom(ride.riderId, ride.id);
  if (ride.driverId) void leaveRideRoom(ride.driverId, ride.id);

  const otherPartyId = userId === ride.riderId ? ride.driverId : ride.riderId;
  if (otherPartyId) {
    void notificationService.send(otherPartyId, {
      type: NotificationType.RideCancelled,
      title: 'Ride cancelled',
      body: ride.cancelReason ?? 'The ride has been cancelled',
      data: { rideId: ride.id },
    });
  }

  return ride;
}

export {
  acceptRide,
  arriveAtPickup,
  calculateFare,
  cancelRide,
  completeRide,
  getAvailableRides,
  getMyRides,
  getRideDetails,
  getRideOffers,
  getScheduledRides,
  pickDriver,
  refuseRide,
  requestRide,
  startRide,
};
export type { CreateRideInput, FareEstimateInput };
