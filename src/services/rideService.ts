import { Op, Transaction } from 'sequelize';

import { config } from '@/config/index';
import { Ride, RideOffer, sequelize, User } from '@/models/index';
import { OfferStatus, RideStatus, VehicleType } from '@/types/enums';
import { ErrorCodes, appError } from '@/types/errorCodes';
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

function calculateFare(input: FareEstimateInput): { fare: number; currency: string } {
  const { fare: fareConfig } = config;
  const type = input.vehicleType;

  const baseFare = fareConfig.baseFare[type];
  const distanceCost = input.distanceKm * fareConfig.perKm[type];
  const timeCost = input.estimatedMinutes * fareConfig.perMin[type];
  const fare = Math.round((baseFare + distanceCost + timeCost) * 100) / 100;

  return { fare, currency: fareConfig.currency };
}

// ── Request Ride ────────────────────────────────────────────────────────────

async function requestRide(riderId: string, input: CreateRideInput): Promise<Ride> {
  const { fare } = calculateFare({
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

// ── Ride Lifecycle (basic status validation — full state machine in Phase 6) ─

async function acceptRide(rideId: string, driverId: string): Promise<Ride> {
  return sequelize.transaction(
    { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
    async (t) => {
      const ride = await Ride.findByPk(rideId, { lock: t.LOCK.UPDATE, transaction: t });
      if (!ride) throw appError(ErrorCodes.RIDE.RIDE_NOT_FOUND);
      if (ride.status !== RideStatus.Pending && ride.status !== RideStatus.Offered) {
        throw appError(ErrorCodes.RIDE.RIDE_INVALID_STATUS);
      }
      if (ride.driverId) throw appError(ErrorCodes.RIDE.RIDE_ALREADY_ACCEPTED);

      ride.driverId = driverId;
      ride.status = RideStatus.Accepted;
      await ride.save({ transaction: t });
      return ride;
    },
  );
}

async function refuseRide(rideId: string, driverId: string): Promise<void> {
  const offer = await RideOffer.findOne({ where: { rideId, driverId } });
  if (!offer) throw appError(ErrorCodes.RIDE.OFFER_NOT_FOUND);

  offer.status = OfferStatus.Rejected;
  await offer.save();
}

async function arriveAtPickup(rideId: string, driverId: string): Promise<Ride> {
  const ride = await Ride.findByPk(rideId);
  if (!ride) throw appError(ErrorCodes.RIDE.RIDE_NOT_FOUND);
  if (ride.driverId !== driverId) throw appError(ErrorCodes.AUTH.FORBIDDEN);
  if (ride.status !== RideStatus.Accepted) throw appError(ErrorCodes.RIDE.RIDE_INVALID_STATUS);

  ride.arrivedAt = new Date();
  await ride.save();
  return ride;
}

async function startRide(rideId: string, driverId: string): Promise<Ride> {
  const ride = await Ride.findByPk(rideId);
  if (!ride) throw appError(ErrorCodes.RIDE.RIDE_NOT_FOUND);
  if (ride.driverId !== driverId) throw appError(ErrorCodes.AUTH.FORBIDDEN);
  if (ride.status !== RideStatus.Accepted) throw appError(ErrorCodes.RIDE.RIDE_INVALID_STATUS);

  ride.status = RideStatus.InProgress;
  ride.startedAt = new Date();
  await ride.save();
  return ride;
}

async function completeRide(rideId: string, driverId: string): Promise<Ride> {
  const ride = await Ride.findByPk(rideId);
  if (!ride) throw appError(ErrorCodes.RIDE.RIDE_NOT_FOUND);
  if (ride.driverId !== driverId) throw appError(ErrorCodes.AUTH.FORBIDDEN);
  if (ride.status !== RideStatus.InProgress) throw appError(ErrorCodes.RIDE.RIDE_INVALID_STATUS);

  ride.status = RideStatus.Completed;
  ride.finalFare = ride.calculatedFare;
  ride.completedAt = new Date();
  ride.commissionAmount = Number(ride.calculatedFare) * (Number(ride.commissionRate) / 100);
  await ride.save();
  return ride;
}

async function cancelRide(rideId: string, userId: string, reason?: string): Promise<Ride> {
  const ride = await Ride.findByPk(rideId);
  if (!ride) throw appError(ErrorCodes.RIDE.RIDE_NOT_FOUND);
  if (ride.riderId !== userId && ride.driverId !== userId) {
    throw appError(ErrorCodes.AUTH.FORBIDDEN);
  }
  if (ride.status === RideStatus.Completed || ride.status === RideStatus.Cancelled) {
    throw appError(ErrorCodes.RIDE.RIDE_INVALID_STATUS);
  }

  ride.status = RideStatus.Cancelled;
  ride.cancelledBy = userId === ride.riderId ? 'rider' : 'driver';
  ride.cancelReason = reason || null;
  await ride.save();
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
  refuseRide,
  requestRide,
  startRide,
};
export type { CreateRideInput, FareEstimateInput };
