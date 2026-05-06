import { fn, literal, Transaction } from 'sequelize';

import { DriverProfile, Rating, Ride, sequelize, User } from '@/models/index';
import { cacheDel } from '@/services/cacheService';
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
  const rating = await sequelize.transaction(
    { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
    async (t) => {
      const ride = await Ride.findByPk(rideId, { transaction: t });
      if (!ride) throw appError(ErrorCodes.RIDE.RIDE_NOT_FOUND);
      if (ride.status !== RideStatus.Completed) throw appError(ErrorCodes.RIDE.RIDE_INVALID_STATUS);
      if (ride.riderId !== riderId) throw appError(ErrorCodes.AUTH.FORBIDDEN);
      if (!ride.driverId) throw appError(ErrorCodes.RIDE.RIDE_INVALID_STATUS);

      const existing = await Rating.findOne({ where: { rideId }, transaction: t });
      if (existing) throw appError(ErrorCodes.RATING.RATING_ALREADY_EXISTS);

      const created = await Rating.create(
        {
          rideId,
          riderId,
          driverId: ride.driverId,
          score,
          comment: comment || null,
        },
        { transaction: t },
      );

      // Update driver aggregate rating with FOR UPDATE lock
      const driverProfile = await DriverProfile.findOne({
        where: { userId: ride.driverId },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });

      if (driverProfile) {
        const result = await Rating.findOne({
          where: { driverId: ride.driverId },
          attributes: [[fn('AVG', literal('score')), 'avgScore']],
          raw: true,
          transaction: t,
        });

        if (result) {
          const avgScore = Number((result as unknown as { avgScore: string }).avgScore);
          driverProfile.rating = Math.round(avgScore * 100) / 100;
          await driverProfile.save({ transaction: t });
        }
      }

      return { created, driverId: ride.driverId };
    },
  );

  // Invalidate driver profile cache after transaction commits
  await cacheDel(`driver:${rating.driverId}:profile`);

  return rating.created;
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
