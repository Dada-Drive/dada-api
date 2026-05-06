import { Op } from 'sequelize';

import { Ride, SharedRidePassenger, User } from '@/models/index';
import { RideStatus, SharedPassengerStatus } from '@/types/enums';
import { ErrorCodes, appError } from '@/types/errorCodes';
import { buildPaginationMeta, parsePaginationQuery } from '@/utils/pagination';

import type { PaginationMeta } from '@/types/pagination';

// ── Types ───────────────────────────────────────────────────────────────────

interface JoinSharedRideInput {
  pickupLat: number;
  pickupLng: number;
  pickupAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  dropoffAddress: string;
}

// ── Get Available Shared Rides ──────────────────────────────────────────────

async function getAvailableSharedRides(
  query: Record<string, unknown>,
): Promise<{ rows: Ride[]; meta: PaginationMeta }> {
  const { offset, limit, page } = parsePaginationQuery(query);

  const { rows, count } = await Ride.findAndCountAll({
    where: {
      isShared: true,
      status: { [Op.in]: [RideStatus.Pending, RideStatus.Offered, RideStatus.Accepted] },
      sharedSeatsAvailable: { [Op.gt]: 0 },
    },
    order: [['createdAt', 'DESC']],
    offset,
    limit,
    include: [{ model: User, as: 'rider', attributes: ['id', 'fullName', 'avatarUrl'] }],
  });

  return { rows, meta: buildPaginationMeta(count, page, limit) };
}

// ── Join Shared Ride ────────────────────────────────────────────────────────

async function joinSharedRide(
  rideId: string,
  riderId: string,
  input: JoinSharedRideInput,
): Promise<SharedRidePassenger> {
  const ride = await Ride.findByPk(rideId);
  if (!ride) throw appError(ErrorCodes.RIDE.RIDE_NOT_FOUND);
  if (!ride.isShared) throw appError(ErrorCodes.RIDE.RIDE_INVALID_STATUS);
  if (!ride.sharedSeatsAvailable || ride.sharedSeatsAvailable <= 0) {
    throw appError(ErrorCodes.GENERAL.VALIDATION_ERROR, { message: 'No seats available' });
  }

  const passenger = await SharedRidePassenger.create({
    primaryRideId: rideId,
    riderId,
    pickupLat: input.pickupLat,
    pickupLng: input.pickupLng,
    pickupAddress: input.pickupAddress,
    dropoffLat: input.dropoffLat,
    dropoffLng: input.dropoffLng,
    dropoffAddress: input.dropoffAddress,
  });

  ride.sharedSeatsAvailable -= 1;
  await ride.save();

  return passenger;
}

// ── Get Passengers ──────────────────────────────────────────────────────────

async function getPassengers(rideId: string): Promise<SharedRidePassenger[]> {
  const ride = await Ride.findByPk(rideId);
  if (!ride) throw appError(ErrorCodes.RIDE.RIDE_NOT_FOUND);

  return SharedRidePassenger.findAll({
    where: { primaryRideId: rideId },
    include: [{ model: User, as: 'rider', attributes: ['id', 'fullName', 'avatarUrl', 'phone'] }],
    order: [['pickupOrder', 'ASC NULLS LAST']],
  });
}

// ── Mark Picked Up ──────────────────────────────────────────────────────────

async function markPickedUp(rideId: string, passengerId: string): Promise<SharedRidePassenger> {
  const passenger = await SharedRidePassenger.findOne({
    where: { id: passengerId, primaryRideId: rideId },
  });
  if (!passenger) throw appError(ErrorCodes.GENERAL.NOT_FOUND);

  passenger.status = SharedPassengerStatus.PickedUp;
  passenger.pickedUpAt = new Date();
  await passenger.save();
  return passenger;
}

// ── Mark Dropped Off ────────────────────────────────────────────────────────

async function markDroppedOff(rideId: string, passengerId: string): Promise<SharedRidePassenger> {
  const passenger = await SharedRidePassenger.findOne({
    where: { id: passengerId, primaryRideId: rideId },
  });
  if (!passenger) throw appError(ErrorCodes.GENERAL.NOT_FOUND);

  passenger.status = SharedPassengerStatus.DroppedOff;
  passenger.droppedOffAt = new Date();
  await passenger.save();
  return passenger;
}

// ── Leave Shared Ride ───────────────────────────────────────────────────────

async function leaveSharedRide(rideId: string, riderId: string): Promise<void> {
  const passenger = await SharedRidePassenger.findOne({
    where: { primaryRideId: rideId, riderId },
  });
  if (!passenger) throw appError(ErrorCodes.GENERAL.NOT_FOUND);

  passenger.status = SharedPassengerStatus.Cancelled;
  await passenger.save();

  // Restore seat
  const ride = await Ride.findByPk(rideId);
  if (ride && ride.sharedSeatsAvailable !== null) {
    ride.sharedSeatsAvailable += 1;
    await ride.save();
  }
}

export {
  getAvailableSharedRides,
  getPassengers,
  joinSharedRide,
  leaveSharedRide,
  markDroppedOff,
  markPickedUp,
};
export type { JoinSharedRideInput };
