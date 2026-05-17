import type { UserRole } from '@/types/enums';

// ── Socket Data ─────────────────────────────────────────────────────────────

interface SocketUser {
  userId: string;
  role: UserRole;
}

interface SocketData {
  user: SocketUser;
  tokenExp: number;
  tokenJti: string;
}

// ── Ack Response ────────────────────────────────────────────────────────────

interface AckResponse {
  success: boolean;
  error?: string;
}

// ── Client → Server Events ──────────────────────────────────────────────────

interface LocationUpdatePayload {
  lat: number;
  lng: number;
  heading?: number;
}

interface NearbySubscribePayload {
  lat: number;
  lng: number;
  radiusKm: number;
}

interface DriverStatusPayload {
  isOnline: boolean;
}

interface ClientToServerEvents {
  'location:update': (payload: LocationUpdatePayload, ack: (res: AckResponse) => void) => void;
  'driver:status': (payload: DriverStatusPayload, ack: (res: AckResponse) => void) => void;
  'nearby:subscribe': (payload: NearbySubscribePayload, ack: (res: AckResponse) => void) => void;
  'nearby:unsubscribe': (payload: Record<string, never>, ack: (res: AckResponse) => void) => void;
}

// ── Server → Client Events ──────────────────────────────────────────────────

interface RideRequestPayload {
  rideId: string;
  pickupLat: number;
  pickupLng: number;
  pickupAddress: string;
  dropoffAddress: string;
  vehicleType: string;
  calculatedFare: number;
  riderName: string;
}

interface RideOfferPayload {
  rideId: string;
  offerId: string;
  driverId: string;
  driverName: string;
  driverRating: number;
  vehicleType: string;
  offeredFare: number;
  expiresAt?: string;
}

interface OfferExpiredPayload {
  rideId: string;
  offerId: string;
  driverId: string;
}

interface RideAcceptedPayload {
  rideId: string;
  riderId: string;
  riderName: string;
  pickupLat: number;
  pickupLng: number;
  pickupAddress: string;
  dropoffAddress: string;
}

interface OfferRejectedPayload {
  rideId: string;
  offerId: string;
}

interface RideStatusPayload {
  rideId: string;
  status: string;
  timestamp: string;
}

interface DriverArrivedPayload {
  rideId: string;
  arrivedAt: string;
}

interface DriverLocationPayload {
  driverId: string;
  lat: number;
  lng: number;
  heading?: number;
  timestamp: string;
}

interface RideCompletedPayload {
  rideId: string;
  status: string;
  finalFare: number;
  commissionAmount?: number;
  completedAt: string;
}

interface RideCancelledPayload {
  rideId: string;
  cancelledBy: string;
  cancelReason: string | null;
}

interface NearbyDriversPayload {
  drivers: Array<{
    id: string;
    lat: number;
    lng: number;
    vehicleType: string;
    heading: number | null;
  }>;
}

interface ServerToClientEvents {
  'ride:new_request': (payload: RideRequestPayload) => void;
  'ride:new_offer': (payload: RideOfferPayload) => void;
  'ride:offer_expired': (payload: OfferExpiredPayload) => void;
  'ride:accepted': (payload: RideAcceptedPayload) => void;
  'ride:offer_rejected': (payload: OfferRejectedPayload) => void;
  'ride:status_changed': (payload: RideStatusPayload) => void;
  'ride:driver_arrived': (payload: DriverArrivedPayload) => void;
  'ride:driver_location': (payload: DriverLocationPayload) => void;
  'ride:completed': (payload: RideCompletedPayload) => void;
  'ride:cancelled': (payload: RideCancelledPayload) => void;
  'nearby:drivers': (payload: NearbyDriversPayload) => void;
}

// ── Inter-Server Events (Redis adapter) ─────────────────────────────────────

type InterServerEvents = Record<string, never>;

export type {
  AckResponse,
  ClientToServerEvents,
  DriverArrivedPayload,
  DriverLocationPayload,
  DriverStatusPayload,
  InterServerEvents,
  LocationUpdatePayload,
  NearbyDriversPayload,
  NearbySubscribePayload,
  OfferExpiredPayload,
  OfferRejectedPayload,
  RideAcceptedPayload,
  RideCancelledPayload,
  RideCompletedPayload,
  RideOfferPayload,
  RideRequestPayload,
  RideStatusPayload,
  ServerToClientEvents,
  SocketData,
  SocketUser,
};
