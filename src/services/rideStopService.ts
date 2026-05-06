import { Ride, RideStop } from '@/models/index';
import { RideStatus } from '@/types/enums';
import { ErrorCodes, appError } from '@/types/errorCodes';

// ── Types ───────────────────────────────────────────────────────────────────

interface AddStopInput {
  address: string;
  lat: number;
  lng: number;
  orderIndex: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function getRideOrThrow(rideId: string): Promise<Ride> {
  const ride = await Ride.findByPk(rideId);
  if (!ride) throw appError(ErrorCodes.RIDE.RIDE_NOT_FOUND);
  if (ride.status === RideStatus.Completed || ride.status === RideStatus.Cancelled) {
    throw appError(ErrorCodes.RIDE.RIDE_INVALID_STATUS);
  }
  return ride;
}

// ── Get Stops ───────────────────────────────────────────────────────────────

async function getStops(rideId: string): Promise<RideStop[]> {
  const ride = await Ride.findByPk(rideId);
  if (!ride) throw appError(ErrorCodes.RIDE.RIDE_NOT_FOUND);

  return RideStop.findAll({
    where: { rideId },
    order: [['orderIndex', 'ASC']],
  });
}

// ── Add Stops ───────────────────────────────────────────────────────────────

async function addStops(rideId: string, stops: AddStopInput[]): Promise<RideStop[]> {
  await getRideOrThrow(rideId);

  const records = stops.map((s) => ({
    rideId,
    address: s.address,
    lat: s.lat,
    lng: s.lng,
    orderIndex: s.orderIndex,
  }));

  return RideStop.bulkCreate(records);
}

// ── Mark Arrival ────────────────────────────────────────────────────────────

async function markArrival(rideId: string, stopId: string): Promise<RideStop> {
  await getRideOrThrow(rideId);

  const stop = await RideStop.findOne({ where: { id: stopId, rideId } });
  if (!stop) throw appError(ErrorCodes.RIDE.RIDE_STOP_NOT_FOUND);

  stop.arrivedAt = new Date();
  await stop.save();
  return stop;
}

// ── Mark Departure ──────────────────────────────────────────────────────────

async function markDeparture(rideId: string, stopId: string): Promise<RideStop> {
  await getRideOrThrow(rideId);

  const stop = await RideStop.findOne({ where: { id: stopId, rideId } });
  if (!stop) throw appError(ErrorCodes.RIDE.RIDE_STOP_NOT_FOUND);

  stop.leftAt = new Date();
  if (stop.arrivedAt) {
    stop.waitMinutes = (Date.now() - stop.arrivedAt.getTime()) / 60000;
  }
  await stop.save();
  return stop;
}

export { addStops, getStops, markArrival, markDeparture };
export type { AddStopInput };
