import request from 'supertest';

import { app } from '@/app';
import { generateTestToken } from '@/tests/helpers/auth';
import { createTestUser } from '@/tests/helpers/factories';
import { UserRole } from '@/types/enums';

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_PASSWORD = 'TestPass1';

const DEFAULT_RIDE_PARAMS = {
  vehicleType: 'economy',
  pickupLat: 36.8065,
  pickupLng: 10.1815,
  pickupAddress: 'Tunis Centre',
  dropoffLat: 36.8265,
  dropoffLng: 10.2015,
  dropoffAddress: 'La Marsa',
  distanceKm: 5.0,
  estimatedMinutes: 15,
};

const DEFAULT_PROFILE_PARAMS = {
  licenseNumber: 'LIC-123456',
  licenseExpiry: '2028-12-31',
  cin: 'CIN-789012',
  cinDeliveredAt: '2020-01-01',
};

const DEFAULT_VEHICLE_PARAMS = {
  make: 'Toyota',
  model: 'Corolla',
  plateNumber: 'TUN-1234',
  color: 'White',
  vehicleType: 'economy',
};

// ── Phone counter ────────────────────────────────────────────────────────────

let phoneCounter = 0;

function nextPhone(): string {
  phoneCounter += 1;
  return `+2162000${String(phoneCounter).padStart(4, '0')}`;
}

function resetE2eCounters(): void {
  phoneCounter = 0;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

interface RegisterResult {
  userId: string;
  accessToken: string;
  refreshToken: string;
  phone: string;
}

async function registerAndLogin(overrides?: {
  phone?: string;
  fullName?: string;
}): Promise<RegisterResult> {
  const phone = overrides?.phone ?? nextPhone();
  const fullName = overrides?.fullName ?? 'Test User';

  const registerRes = await request(app)
    .post('/api/v1/auth/register')
    .send({ fullName, phone, password: DEFAULT_PASSWORD });

  if (registerRes.status !== 201) {
    throw new Error(`Register failed: ${registerRes.status} ${JSON.stringify(registerRes.body)}`);
  }

  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ phone, password: DEFAULT_PASSWORD });

  if (loginRes.status !== 200) {
    throw new Error(`Login failed: ${loginRes.status} ${JSON.stringify(loginRes.body)}`);
  }

  return {
    userId: loginRes.body.data.user.id,
    accessToken: loginRes.body.data.accessToken,
    refreshToken: loginRes.body.data.refreshToken,
    phone,
  };
}

interface ApprovedDriverResult {
  userId: string;
  accessToken: string;
  phone: string;
}

async function setupApprovedDriver(): Promise<ApprovedDriverResult> {
  // 1. Register via HTTP
  const { userId, phone } = await registerAndLogin({ fullName: 'Test Driver' });

  // 2. Generate token for profile/vehicle creation (role is still 'rider' at this point)
  const token = generateTestToken(userId, UserRole.Rider);

  // 3. Create driver profile
  const profileRes = await request(app)
    .post('/api/v1/driver/profile')
    .set('Authorization', `Bearer ${token}`)
    .send(DEFAULT_PROFILE_PARAMS);

  if (profileRes.status !== 201) {
    throw new Error(
      `Create profile failed: ${profileRes.status} ${JSON.stringify(profileRes.body)}`,
    );
  }

  // 4. Register vehicle
  const vehicleRes = await request(app)
    .post('/api/v1/driver/vehicle')
    .set('Authorization', `Bearer ${token}`)
    .send(DEFAULT_VEHICLE_PARAMS);

  if (vehicleRes.status !== 201) {
    throw new Error(
      `Register vehicle failed: ${vehicleRes.status} ${JSON.stringify(vehicleRes.body)}`,
    );
  }

  // 5. Admin approves
  const admin = await createTestUser({ role: UserRole.Admin });
  const adminToken = generateTestToken(admin.id, UserRole.Admin);
  const approveRes = await request(app)
    .patch(`/api/v1/admin/drivers/${userId}/approve`)
    .set('Authorization', `Bearer ${adminToken}`);

  if (approveRes.status !== 200) {
    throw new Error(`Approve failed: ${approveRes.status} ${JSON.stringify(approveRes.body)}`);
  }

  // 6. Re-login to get driver-role token
  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ phone, password: DEFAULT_PASSWORD });

  return {
    userId,
    accessToken: loginRes.body.data.accessToken,
    phone,
  };
}

interface RideResult {
  rideId: string;
  body: Record<string, unknown>;
}

async function createRideViaHttp(
  token: string,
  overrides?: Partial<typeof DEFAULT_RIDE_PARAMS>,
): Promise<RideResult> {
  const res = await request(app)
    .post('/api/v1/rides')
    .set('Authorization', `Bearer ${token}`)
    .send({ ...DEFAULT_RIDE_PARAMS, ...overrides });

  if (res.status !== 201) {
    throw new Error(`Create ride failed: ${res.status} ${JSON.stringify(res.body)}`);
  }

  return { rideId: res.body.data.id, body: res.body.data };
}

async function completeRideFlow(
  riderToken: string,
  driverToken: string,
  rideId: string,
): Promise<{ offerId: string }> {
  // Driver accepts
  const acceptRes = await request(app)
    .post(`/api/v1/rides/${rideId}/accept`)
    .set('Authorization', `Bearer ${driverToken}`);

  if (acceptRes.status !== 200) {
    throw new Error(`Accept failed: ${acceptRes.status} ${JSON.stringify(acceptRes.body)}`);
  }

  const offerId = acceptRes.body.data.offer.id as string;

  // Rider picks driver
  const pickRes = await request(app)
    .post(`/api/v1/rides/${rideId}/pick-driver`)
    .set('Authorization', `Bearer ${riderToken}`)
    .send({ offerId });

  if (pickRes.status !== 200) {
    throw new Error(`Pick driver failed: ${pickRes.status} ${JSON.stringify(pickRes.body)}`);
  }

  // Driver arrives
  const arriveRes = await request(app)
    .patch(`/api/v1/rides/${rideId}/arrive`)
    .set('Authorization', `Bearer ${driverToken}`);

  if (arriveRes.status !== 200) {
    throw new Error(`Arrive failed: ${arriveRes.status} ${JSON.stringify(arriveRes.body)}`);
  }

  // Driver starts
  const startRes = await request(app)
    .patch(`/api/v1/rides/${rideId}/start`)
    .set('Authorization', `Bearer ${driverToken}`);

  if (startRes.status !== 200) {
    throw new Error(`Start failed: ${startRes.status} ${JSON.stringify(startRes.body)}`);
  }

  // Driver completes
  const completeRes = await request(app)
    .patch(`/api/v1/rides/${rideId}/complete`)
    .set('Authorization', `Bearer ${driverToken}`);

  if (completeRes.status !== 200) {
    throw new Error(`Complete failed: ${completeRes.status} ${JSON.stringify(completeRes.body)}`);
  }

  return { offerId };
}

export {
  completeRideFlow,
  createRideViaHttp,
  DEFAULT_PASSWORD,
  DEFAULT_RIDE_PARAMS,
  registerAndLogin,
  resetE2eCounters,
  setupApprovedDriver,
};
