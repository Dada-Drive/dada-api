import { Job, Worker } from 'bullmq';
import { fn, literal } from 'sequelize';

import { config } from '@/config/index';
import { createBullMQConnection } from '@/jobs/connection';
import { DriverProfile, Rating } from '@/models/index';
import { logger } from '@/utils/logger';

// ── Types ────────────────────────────────────────────────────────────────────

export interface RatingRecalculationJobData {
  driverId: string;
  triggeredBy: 'rating_submit' | 'rating_delete' | 'admin_adjustment';
}

// ── Processor ────────────────────────────────────────────────────────────────

export async function processRatingRecalculation(
  job: Job<RatingRecalculationJobData>,
): Promise<void> {
  const { driverId } = job.data;

  const result = await Rating.findOne({
    where: { driverId },
    attributes: [[fn('AVG', literal('score')), 'avgScore']],
    raw: true,
  });

  if (!result) {
    logger.debug('No ratings found for driver — skipping recalculation', {
      driverId,
      component: 'jobs',
    });
    return;
  }

  const avgScore = Number((result as unknown as { avgScore: string }).avgScore);
  const roundedRating = Math.round(avgScore * 100) / 100;

  await DriverProfile.update({ rating: roundedRating }, { where: { userId: driverId } });

  logger.info('Driver rating recalculated', {
    driverId,
    newRating: roundedRating,
    component: 'jobs',
  });
}

// ── Worker Factory ───────────────────────────────────────────────────────────

export function createRatingRecalculationWorker(): Worker<RatingRecalculationJobData> {
  const worker = new Worker<RatingRecalculationJobData>(
    'rating-recalculation',
    processRatingRecalculation,
    {
      connection: createBullMQConnection(),
      concurrency: 3,
    },
  );

  worker.on('failed', (job, err) => {
    logger.error('Rating recalculation job failed', {
      jobId: job?.id,
      driverId: job?.data.driverId,
      attempt: job?.attemptsMade,
      maxAttempts: config.jobs.ratingRecalculation.attempts,
      error: err.message,
      component: 'jobs',
    });
  });

  return worker;
}
