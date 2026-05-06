import { fn, literal } from 'sequelize';

import { DriverProfile, Rating, Ride, User } from '@/models/index';
import { RideStatus } from '@/types/enums';
import { ErrorCodes, appError } from '@/types/errorCodes';
import { buildPaginationMeta, parsePaginationQuery } from '@/utils/pagination';

import type { PaginationMeta } from '@/types/pagination';

// ── Submit Rating ───────────────────────────────────────────────────────────

async function submitRating(
  rideId: string,
  riderId: string,
  score: number,
  comment?: string,
): Promise<Rating> {
  const ride = await Ride.findByPk(rideId);
  if (!ride) throw appError(ErrorCodes.RIDE.RIDE_NOT_FOUND);
  if (ride.status !== RideStatus.Completed) throw appError(ErrorCodes.RIDE.RIDE_INVALID_STATUS);
  if (ride.riderId !== riderId) throw appError(ErrorCodes.AUTH.FORBIDDEN);
  if (!ride.driverId) throw appError(ErrorCodes.RIDE.RIDE_INVALID_STATUS);

  const existing = await Rating.findOne({ where: { rideId } });
  if (existing) throw appError(ErrorCodes.RATING.RATING_ALREADY_EXISTS);

  const rating = await Rating.create({
    rideId,
    riderId,
    driverId: ride.driverId,
    score,
    comment: comment || null,
  });

  // Update driver aggregate rating
  const result = await Rating.findOne({
    where: { driverId: ride.driverId },
    attributes: [[fn('AVG', literal('score')), 'avgScore']],
    raw: true,
  });

  if (result) {
    const avgScore = Number((result as unknown as { avgScore: string }).avgScore);
    await DriverProfile.update(
      { rating: Math.round(avgScore * 100) / 100 },
      { where: { userId: ride.driverId } },
    );
  }

  return rating;
}

// ── Get Ride Rating ─────────────────────────────────────────────────────────

async function getRideRating(rideId: string): Promise<Rating> {
  const rating = await Rating.findOne({
    where: { rideId },
    include: [{ model: User, as: 'rider', attributes: ['id', 'fullName', 'avatarUrl'] }],
  });
  if (!rating) throw appError(ErrorCodes.RATING.RATING_NOT_FOUND);
  return rating;
}

// ── Get Driver Ratings ──────────────────────────────────────────────────────

async function getDriverRatings(
  driverId: string,
  query: Record<string, unknown>,
): Promise<{ rows: Rating[]; meta: PaginationMeta }> {
  const { offset, limit, page } = parsePaginationQuery(query);

  const { rows, count } = await Rating.findAndCountAll({
    where: { driverId },
    order: [['createdAt', 'DESC']],
    offset,
    limit,
    include: [{ model: User, as: 'rider', attributes: ['id', 'fullName', 'avatarUrl'] }],
  });

  return { rows, meta: buildPaginationMeta(count, page, limit) };
}

export { getDriverRatings, getRideRating, submitRating };
