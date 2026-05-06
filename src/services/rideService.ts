import { Op, QueryTypes, Transaction } from 'sequelize';

import { FARE_CONFIG } from '@/config/fareConfig';
import { config } from '@/config/index';
import { Ride, RideOffer, sequelize, User, Wallet, WalletTransaction } from '@/models/index';
import { cacheGet, cacheSet } from '@/services/cacheService';
import {
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

  return Ride.create({
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
  return sequelize.transaction(
    { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
    async (t) => {
      const ride = await Ride.findByPk(rideId, { lock: t.LOCK.UPDATE, transaction: t });
      if (!ride) throw appError(ErrorCodes.RIDE.RIDE_NOT_FOUND);

      // Only Pending or Offered rides can receive new offers
      if (ride.status !== RideStatus.Pending && ride.status !== RideStatus.Offered) {
        throw appError(ErrorCodes.RIDE.RIDE_INVALID_STATUS);
      }

      // Check if this driver already offered
      const existing = await RideOffer.findOne({
        where: { rideId, driverId },
        transaction: t,
      });
      if (existing) throw appError(ErrorCodes.RIDE.RIDE_ALREADY_ACCEPTED);

      const offer = await RideOffer.create(
        { rideId, driverId, offeredFare: Number(ride.calculatedFare) },
        { transaction: t },
      );

      // Transition Pending → Offered on first offer
      if (ride.status === RideStatus.Pending) {
        validateTransition(ride.status, RideStatus.Offered);
        ride.status = RideStatus.Offered;
        await ride.save({ transaction: t });
      }

      return { ride, offer };
    },
  );
}

// ── Pick Driver ────────────────────────────────────────────────────────────

async function pickDriver(rideId: string, riderId: string, offerId: string): Promise<Ride> {
  return sequelize.transaction(
    { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
    async (t) => {
      const ride = await Ride.findByPk(rideId, { lock: t.LOCK.UPDATE, transaction: t });
      if (!ride) throw appError(ErrorCodes.RIDE.RIDE_NOT_FOUND);
      if (ride.riderId !== riderId) throw appError(ErrorCodes.AUTH.FORBIDDEN);

      validateTransition(ride.status, RideStatus.Accepted);

      const offer = await RideOffer.findOne({
        where: { id: offerId, rideId, status: OfferStatus.Pending },
        transaction: t,
      });
      if (!offer) throw appError(ErrorCodes.RIDE.OFFER_NOT_FOUND);

      // Accept the selected offer
      offer.status = OfferStatus.Accepted;
      await offer.save({ transaction: t });

      // Reject all other pending offers
      await RideOffer.update(
        { status: OfferStatus.Rejected },
        {
          where: { rideId, id: { [Op.ne]: offerId }, status: OfferStatus.Pending },
          transaction: t,
        },
      );

      ride.driverId = offer.driverId;
      ride.status = RideStatus.Accepted;
      await ride.save({ transaction: t });
      return ride;
    },
  );
}

// ── Refuse Ride ────────────────────────────────────────────────────────────

async function refuseRide(rideId: string, driverId: string): Promise<void> {
  return sequelize.transaction(
    { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
    async (t) => {
      const offer = await RideOffer.findOne({
        where: { rideId, driverId, status: OfferStatus.Pending },
        transaction: t,
      });
      if (!offer) throw appError(ErrorCodes.RIDE.OFFER_NOT_FOUND);

      offer.status = OfferStatus.Rejected;
      await offer.save({ transaction: t });
    },
  );
}

async function arriveAtPickup(rideId: string, driverId: string): Promise<Ride> {
  return sequelize.transaction(
    { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
    async (t) => {
      const ride = await Ride.findByPk(rideId, { lock: t.LOCK.UPDATE, transaction: t });
      if (!ride) throw appError(ErrorCodes.RIDE.RIDE_NOT_FOUND);
      if (ride.driverId !== driverId) throw appError(ErrorCodes.AUTH.FORBIDDEN);
      if (ride.status !== RideStatus.Accepted) throw appError(ErrorCodes.RIDE.RIDE_INVALID_STATUS);

      ride.arrivedAt = new Date();
      await ride.save({ transaction: t });
      return ride;
    },
  );
}

async function startRide(rideId: string, driverId: string): Promise<Ride> {
  return sequelize.transaction(
    { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
    async (t) => {
      const ride = await Ride.findByPk(rideId, { lock: t.LOCK.UPDATE, transaction: t });
      if (!ride) throw appError(ErrorCodes.RIDE.RIDE_NOT_FOUND);
      if (ride.driverId !== driverId) throw appError(ErrorCodes.AUTH.FORBIDDEN);
      validateTransition(ride.status, RideStatus.InProgress);

      ride.status = RideStatus.InProgress;
      ride.startedAt = new Date();
      await ride.save({ transaction: t });
      return ride;
    },
  );
}

async function completeRide(rideId: string, driverId: string): Promise<Ride> {
  return sequelize.transaction(
    { isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE },
    async (t) => {
      const ride = await Ride.findByPk(rideId, { lock: t.LOCK.UPDATE, transaction: t });
      if (!ride) throw appError(ErrorCodes.RIDE.RIDE_NOT_FOUND);
      if (ride.driverId !== driverId) throw appError(ErrorCodes.AUTH.FORBIDDEN);
      validateTransition(ride.status, RideStatus.Completed);

      // Calculate fare and commission
      const finalFare = Number(ride.calculatedFare);
      const commissionAmount =
        Math.round(finalFare * (Number(ride.commissionRate) / 100) * 100) / 100;
      const driverEarning = Math.round((finalFare - commissionAmount) * 100) / 100;

      // Lock driver wallet
      const wallet = await Wallet.findOne({
        where: { ownerId: driverId },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });
      if (!wallet)
        throw appError(ErrorCodes.GENERAL.NOT_FOUND, { message: 'Driver wallet not found' });
      if (wallet.status !== WalletStatus.Active) throw appError(ErrorCodes.WALLET.WALLET_SUSPENDED);

      // Credit driver wallet with application guard
      const results = await sequelize.query(
        'UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE owner_id = $2 AND balance + $1 >= 0 RETURNING *',
        { bind: [driverEarning, driverId], transaction: t, type: QueryTypes.SELECT },
      );
      if (results.length === 0) {
        throw appError(ErrorCodes.WALLET.INSUFFICIENT_BALANCE);
      }

      // Create earning and commission transaction records
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

      // Update ride
      ride.status = RideStatus.Completed;
      ride.finalFare = finalFare;
      ride.commissionAmount = commissionAmount;
      ride.completedAt = new Date();
      await ride.save({ transaction: t });
      return ride;
    },
  );
}

async function cancelRide(rideId: string, userId: string, reason?: string): Promise<Ride> {
  return sequelize.transaction(
    { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
    async (t) => {
      const ride = await Ride.findByPk(rideId, { lock: t.LOCK.UPDATE, transaction: t });
      if (!ride) throw appError(ErrorCodes.RIDE.RIDE_NOT_FOUND);
      if (ride.riderId !== userId && ride.driverId !== userId) {
        throw appError(ErrorCodes.AUTH.FORBIDDEN);
      }
      validateTransition(ride.status, RideStatus.Cancelled);

      ride.status = RideStatus.Cancelled;
      ride.cancelledBy = userId === ride.riderId ? 'rider' : 'driver';
      ride.cancelReason = reason || null;
      await ride.save({ transaction: t });
      return ride;
    },
  );
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
