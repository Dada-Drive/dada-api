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
