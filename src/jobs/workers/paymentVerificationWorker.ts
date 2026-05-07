import { Job, Worker } from 'bullmq';

import { config } from '@/config/index';
import { createBullMQConnection } from '@/jobs/connection';
import { WalletTransaction } from '@/models/index';
import * as walletService from '@/services/walletService';
import { emitToUser } from '@/sockets/emitter';
import { TransactionStatus } from '@/types/enums';
import { logger } from '@/utils/logger';

// ── Types ────────────────────────────────────────────────────────────────────

export interface PaymentVerificationJobData {
  transactionId: string;
  userId: string;
  flouciPaymentId: string;
}

// ── Processor ────────────────────────────────────────────────────────────────

export async function processPaymentVerification(
  job: Job<PaymentVerificationJobData>,
): Promise<void> {
  const { transactionId, userId, flouciPaymentId } = job.data;

  // Call Flouci verify API
  const response = await fetch(
    `https://developers.flouci.com/api/verify_payment/${flouciPaymentId}`,
    {
      headers: {
        apppublic: config.flouci.appToken,
        appsecret: config.flouci.appSecret,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Flouci API returned ${String(response.status)}`);
  }

  const result = (await response.json()) as { result?: { status?: string } };
  const paymentStatus = result.result?.status;

  if (paymentStatus === 'SUCCESS') {
    await walletService.confirmTopup(transactionId, userId);
    logger.info('Payment verified and wallet credited', {
      transactionId,
      userId,
      component: 'jobs',
    });
  } else if (paymentStatus === 'PENDING') {
    throw new Error('Payment still pending — will retry');
  } else {
    // Payment failed at provider level
    await WalletTransaction.update(
      { status: TransactionStatus.Failed },
      { where: { id: transactionId, status: TransactionStatus.Pending } },
    );
    emitToUser(userId, 'wallet:topup_failed', { transactionId });
    logger.warn('Payment verification failed', {
      transactionId,
      userId,
      paymentStatus,
      component: 'jobs',
    });
  }
}

// ── Worker Factory ───────────────────────────────────────────────────────────

export function createPaymentVerificationWorker(): Worker<PaymentVerificationJobData> {
  const worker = new Worker<PaymentVerificationJobData>(
    'payment-verification',
    processPaymentVerification,
    {
      connection: createBullMQConnection(),
      concurrency: 3,
    },
  );

  worker.on('failed', (job, err) => {
    logger.error('Payment verification job failed', {
      jobId: job?.id,
      transactionId: job?.data.transactionId,
      attempt: job?.attemptsMade,
      maxAttempts: config.jobs.paymentVerification.attempts,
      error: err.message,
      component: 'jobs',
    });

    // On final failure, mark as failed
    if (job && job.attemptsMade >= config.jobs.paymentVerification.attempts) {
      WalletTransaction.update(
        { status: TransactionStatus.Failed },
        { where: { id: job.data.transactionId, status: TransactionStatus.Pending } },
      ).catch((e: Error) => {
        logger.error('Failed to mark transaction as failed', {
          error: e.message,
          component: 'jobs',
        });
      });
    }
  });

  return worker;
}
