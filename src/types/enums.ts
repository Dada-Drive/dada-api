export enum UserRole {
  Rider = 'rider',
  Driver = 'driver',
  Admin = 'admin',
  Pending = 'pending',
}

export enum RideStatus {
  Pending = 'pending',
  Offered = 'offered',
  Accepted = 'accepted',
  InProgress = 'in_progress',
  Completed = 'completed',
  Cancelled = 'cancelled',
}

export enum OfferStatus {
  Pending = 'pending',
  Accepted = 'accepted',
  Rejected = 'rejected',
  Expired = 'expired',
}

export enum VehicleType {
  Economy = 'economy',
  Premium = 'premium',
  Van = 'van',
  Motorcycle = 'motorcycle',
}

export enum ServiceType {
  Taxi = 'taxi',
  Covoiturage = 'covoiturage',
  CoursPartage = 'cours_partage',
  Vespa = 'vespa',
  Services = 'services',
}

export enum WalletStatus {
  Active = 'active',
  Suspended = 'suspended',
  Closed = 'closed',
}

export enum TransactionType {
  TopupManual = 'topup_manual',
  TopupOnline = 'topup_online',
  Commission = 'commission',
  RideEarning = 'ride_earning',
  Withdrawal = 'withdrawal',
}

export enum TransactionStatus {
  Pending = 'pending',
  Completed = 'completed',
  Failed = 'failed',
  Refunded = 'refunded',
}

export enum DevicePlatform {
  Ios = 'ios',
  Android = 'android',
}

export enum SharedPassengerStatus {
  Pending = 'pending',
  Confirmed = 'confirmed',
  PickedUp = 'picked_up',
  DroppedOff = 'dropped_off',
  Cancelled = 'cancelled',
}

export enum NotificationType {
  NewRideRequest = 'new_ride_request',
  RideOffer = 'ride_offer',
  RideAccepted = 'ride_accepted',
  RideOfferRejected = 'ride_offer_rejected',
  DriverArrived = 'driver_arrived',
  RideStarted = 'ride_started',
  RideCompleted = 'ride_completed',
  RideCancelled = 'ride_cancelled',
  RideExpired = 'ride_expired',
  OfferExpired = 'offer_expired',
  WalletTopupConfirmed = 'wallet_topup_confirmed',
  WalletLowBalance = 'wallet_low_balance',
}
