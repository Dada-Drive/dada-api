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
  DEFAULT_PASSWORD,
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

describe('Driver E2E Flow', () => {
  it('onboards driver and completes a ride with wallet credit', async () => {
    // 1. Register & login as rider first (will become driver)
    const driver = await setupApprovedDriver();

    // 2. Go online
    const statusRes = await request(app)
      .patch('/api/v1/driver/status')
      .set('Authorization', `Bearer ${driver.accessToken}`)
      .send({ isOnline: true });

    expect(statusRes.status).toBe(200);

    // 3. Setup a rider and create a ride
    const rider = await registerAndLogin({ fullName: 'Rider' });
    const { rideId } = await createRideViaHttp(rider.accessToken);

    // 4. Complete ride flow
    await completeRideFlow(rider.accessToken, driver.accessToken, rideId);

    // 5. Verify wallet has earnings
    const walletRes = await request(app)
      .get('/api/v1/wallet')
      .set('Authorization', `Bearer ${driver.accessToken}`);

    expect(walletRes.status).toBe(200);
    expect(Number(walletRes.body.data.balance)).toBeGreaterThan(0);

    // 6. Verify transaction records
    const txRes = await request(app)
      .get('/api/v1/wallet/transactions')
      .set('Authorization', `Bearer ${driver.accessToken}`);

    expect(txRes.status).toBe(200);
    const types = txRes.body.data.map((t: { type: string }) => t.type);
    expect(types).toContain('ride_earning');
  });

  it('rejects going online before approval', async () => {
    // Register user
    const { accessToken } = await registerAndLogin({ fullName: 'Unapproved Driver' });

    // Create profile
    await request(app)
      .post('/api/v1/driver/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        licenseNumber: 'LIC-999',
        licenseExpiry: '2028-12-31',
        cin: 'CIN-999',
        cinDeliveredAt: '2020-01-01',
      });

    // Register vehicle
    await request(app)
      .post('/api/v1/driver/vehicle')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        make: 'Peugeot',
        model: '208',
        plateNumber: 'TUN-9999',
        color: 'Black',
      });

    // Try going online without approval
    const res = await request(app)
      .patch('/api/v1/driver/status')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ isOnline: true });

    expect(res.status).toBe(403);
  });

  it('rejects duplicate driver profile creation', async () => {
    const driver = await setupApprovedDriver();

    const res = await request(app)
      .post('/api/v1/driver/profile')
      .set('Authorization', `Bearer ${driver.accessToken}`)
      .send({
        licenseNumber: 'LIC-DUPE',
        licenseExpiry: '2028-12-31',
        cin: 'CIN-DUPE',
        cinDeliveredAt: '2020-01-01',
      });

    expect(res.status).toBe(400);
  });

  it('returns driver profile via GET', async () => {
    const driver = await setupApprovedDriver();

    // Re-login to get fresh driver-role token
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ phone: driver.phone, password: DEFAULT_PASSWORD });

    const token = loginRes.body.data.accessToken as string;

    const res = await request(app)
      .get('/api/v1/driver/profile')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.licenseNumber).toBeDefined();
  });
});
