jest.mock('@/services/notificationService', () => ({
  send: jest.fn().mockResolvedValue(undefined),
}));

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

jest.mock('@/config/firebase', () => ({
  getFirebaseApp: jest.fn(),
}));

import request from 'supertest';

import { app } from '@/app';
import { resetFactoryCounters } from '@/tests/helpers/factories';
import {
  flushTestRedis,
  setupTestDatabase,
  setupTestRedis,
  teardownTestDatabase,
  teardownTestRedis,
  truncateAllTables,
} from '@/tests/setup';

import {
  completeRideFlow,
  createRideViaHttp,
  DEFAULT_RIDE_PARAMS,
  registerAndLogin,
  resetE2eCounters,
  setupApprovedDriver,
} from './e2eHelpers';

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
  resetE2eCounters();
});

describe('Rider E2E Flow', () => {
  it('registers, requests ride, completes ride, and rates driver', async () => {
    // 1. Register & login rider
    const rider = await registerAndLogin({ fullName: 'Rider One' });

    // 2. Setup approved driver
    const driver = await setupApprovedDriver();

    // 3. Driver goes online
    await request(app)
      .patch('/api/v1/driver/status')
      .set('Authorization', `Bearer ${driver.accessToken}`)
      .send({ isOnline: true });

    // 4. Rider creates ride
    const { rideId } = await createRideViaHttp(rider.accessToken);

    // 5. Complete the ride flow (accept → pick → arrive → start → complete)
    await completeRideFlow(rider.accessToken, driver.accessToken, rideId);

    // 6. Verify ride is completed
    const rideRes = await request(app)
      .get(`/api/v1/rides/${rideId}`)
      .set('Authorization', `Bearer ${rider.accessToken}`);

    expect(rideRes.status).toBe(200);
    expect(rideRes.body.data.status).toBe('completed');
    expect(rideRes.body.data.driverId).toBe(driver.userId);

    // 7. Rate driver
    const ratingRes = await request(app)
      .post(`/api/v1/ratings/rides/${rideId}`)
      .set('Authorization', `Bearer ${rider.accessToken}`)
      .send({ score: 5, comment: 'Great ride!' });

    expect(ratingRes.status).toBe(201);
    expect(ratingRes.body.data.score).toBe(5);

    // 8. Verify ride appears in rider history
    const historyRes = await request(app)
      .get('/api/v1/rides/my')
      .set('Authorization', `Bearer ${rider.accessToken}`);

    expect(historyRes.status).toBe(200);
    expect(historyRes.body.data).toHaveLength(1);
    expect(historyRes.body.data[0].id).toBe(rideId);
  });

  it('rider can cancel a pending ride', async () => {
    const rider = await registerAndLogin();
    const { rideId } = await createRideViaHttp(rider.accessToken);

    const res = await request(app)
      .patch(`/api/v1/rides/${rideId}/cancel`)
      .set('Authorization', `Bearer ${rider.accessToken}`)
      .send({ reason: 'Changed my mind' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('cancelled');
  });

  it('rejects ride creation without authentication', async () => {
    const res = await request(app).post('/api/v1/rides').send(DEFAULT_RIDE_PARAMS);

    expect(res.status).toBe(401);
  });

  it('rejects duplicate rating for same ride', async () => {
    const rider = await registerAndLogin();
    const driver = await setupApprovedDriver();

    await request(app)
      .patch('/api/v1/driver/status')
      .set('Authorization', `Bearer ${driver.accessToken}`)
      .send({ isOnline: true });

    const { rideId } = await createRideViaHttp(rider.accessToken);
    await completeRideFlow(rider.accessToken, driver.accessToken, rideId);

    // First rating succeeds
    await request(app)
      .post(`/api/v1/ratings/rides/${rideId}`)
      .set('Authorization', `Bearer ${rider.accessToken}`)
      .send({ score: 4 });

    // Second rating fails
    const dupRes = await request(app)
      .post(`/api/v1/ratings/rides/${rideId}`)
      .set('Authorization', `Bearer ${rider.accessToken}`)
      .send({ score: 5 });

    expect(dupRes.status).toBe(409);
  });
});
