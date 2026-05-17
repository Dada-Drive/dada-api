import { Options, Sequelize } from 'sequelize';

import { config } from '@/config/index';
import { logger } from '@/utils/logger';

import { DeviceToken, initDeviceToken } from './DeviceToken';
import { DriverProfile, initDriverProfile } from './DriverProfile';
import { DriverServiceType, initDriverServiceType } from './DriverServiceType';
import { Notification, initNotification } from './Notification';
import { OtpCode, initOtpCode } from './OtpCode';
import { Rating, initRating } from './Rating';
import { RefreshToken, initRefreshToken } from './RefreshToken';
import { Ride, initRide } from './Ride';
import { RideOffer, initRideOffer } from './RideOffer';
import { RideStop, initRideStop } from './RideStop';
import { SharedRidePassenger, initSharedRidePassenger } from './SharedRidePassenger';
import { User, initUser } from './User';
import { Vehicle, initVehicle } from './Vehicle';
import { Wallet, initWallet } from './Wallet';
import { WalletTransaction, initWalletTransaction } from './WalletTransaction';

const dialectOptions: Options['dialectOptions'] = config.db.ssl
  ? { ssl: { rejectUnauthorized: true } }
  : {};

function queryLogger(sql: string, timing?: number): void {
  const duration = timing ?? 0;
  if (duration >= config.performance.slowQueryErrorMs) {
    logger.error('Slow query detected', { sql, duration, component: 'sequelize' });
  } else if (duration >= config.performance.slowQueryWarnMs) {
    logger.warn('Slow query detected', { sql, duration, component: 'sequelize' });
  } else {
    logger.debug(sql, { duration, component: 'sequelize' });
  }
}

const sequelize = new Sequelize(config.db.url, {
  dialect: 'postgres',
  logging: queryLogger,
  benchmark: true,
  pool: {
    min: config.db.poolMin,
    max: config.db.poolMax,
    acquire: 30000,
    idle: 10000,
  },
  dialectOptions,
  define: {
    underscored: true,
    timestamps: true,
  },
});

// ── Initialize models ──────────────────────────────────────────────────────
initUser(sequelize);
initDriverProfile(sequelize);
initVehicle(sequelize);
initRide(sequelize);
initRideOffer(sequelize);
initRideStop(sequelize);
initSharedRidePassenger(sequelize);
initRating(sequelize);
initWallet(sequelize);
initWalletTransaction(sequelize);
initOtpCode(sequelize);
initRefreshToken(sequelize);
initDeviceToken(sequelize);
initNotification(sequelize);
initDriverServiceType(sequelize);

// ── Associations ───────────────────────────────────────────────────────────
// User ↔ DriverProfile (1:1)
User.hasOne(DriverProfile, { foreignKey: 'userId', as: 'driverProfile' });
DriverProfile.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// DriverProfile ↔ Vehicle (1:1)
DriverProfile.hasOne(Vehicle, { foreignKey: 'driverId', as: 'vehicle' });
Vehicle.belongsTo(DriverProfile, { foreignKey: 'driverId', as: 'driverProfile' });

// User ↔ Ride
User.hasMany(Ride, { foreignKey: 'riderId', as: 'ridesAsRider' });
User.hasMany(Ride, { foreignKey: 'driverId', as: 'ridesAsDriver' });
Ride.belongsTo(User, { foreignKey: 'riderId', as: 'rider' });
Ride.belongsTo(User, { foreignKey: 'driverId', as: 'driver' });

// Ride ↔ RideOffer
Ride.hasMany(RideOffer, { foreignKey: 'rideId', as: 'offers' });
RideOffer.belongsTo(Ride, { foreignKey: 'rideId', as: 'ride' });
RideOffer.belongsTo(User, { foreignKey: 'driverId', as: 'driver' });

// Ride ↔ RideStop
Ride.hasMany(RideStop, { foreignKey: 'rideId', as: 'stops' });
RideStop.belongsTo(Ride, { foreignKey: 'rideId', as: 'ride' });

// Ride ↔ SharedRidePassenger
Ride.hasMany(SharedRidePassenger, { foreignKey: 'primaryRideId', as: 'sharedPassengers' });
SharedRidePassenger.belongsTo(Ride, { foreignKey: 'primaryRideId', as: 'primaryRide' });
SharedRidePassenger.belongsTo(Ride, { foreignKey: 'passengerRideId', as: 'passengerRide' });
SharedRidePassenger.belongsTo(User, { foreignKey: 'riderId', as: 'rider' });

// User ↔ Wallet (1:1)
User.hasOne(Wallet, { foreignKey: 'ownerId', as: 'wallet' });
Wallet.belongsTo(User, { foreignKey: 'ownerId', as: 'owner' });

// User ↔ WalletTransaction
User.hasMany(WalletTransaction, { foreignKey: 'walletOwnerId', as: 'transactions' });
WalletTransaction.belongsTo(User, { foreignKey: 'walletOwnerId', as: 'walletOwner' });

// Ride ↔ Rating (1:1)
Ride.hasOne(Rating, { foreignKey: 'rideId', as: 'rating' });
Rating.belongsTo(Ride, { foreignKey: 'rideId', as: 'ride' });
Rating.belongsTo(User, { foreignKey: 'riderId', as: 'rider' });
Rating.belongsTo(User, { foreignKey: 'driverId', as: 'ratedDriver' });

// User ↔ RefreshToken
User.hasMany(RefreshToken, { foreignKey: 'userId', as: 'refreshTokens' });
RefreshToken.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// User ↔ DeviceToken
User.hasMany(DeviceToken, { foreignKey: 'userId', as: 'deviceTokens' });
DeviceToken.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// User ↔ Notification
User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// User ↔ DriverServiceType (1:N — driver registers for multiple service types)
User.hasMany(DriverServiceType, { foreignKey: 'driverId', as: 'serviceTypes' });
DriverServiceType.belongsTo(User, { foreignKey: 'driverId', as: 'driver' });

// ── Database connection ────────────────────────────────────────────────────
async function initializeDatabase(): Promise<void> {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established', {
      host: sequelize.config.host,
      database: sequelize.config.database,
      component: 'sequelize',
    });
  } catch (error) {
    logger.error('Unable to connect to database', {
      error: error instanceof Error ? error.message : String(error),
      component: 'sequelize',
    });
    throw error;
  }
}

export {
  queryLogger,
  sequelize,
  initializeDatabase,
  User,
  DriverProfile,
  Vehicle,
  Ride,
  RideOffer,
  RideStop,
  SharedRidePassenger,
  Rating,
  Wallet,
  WalletTransaction,
  OtpCode,
  RefreshToken,
  DeviceToken,
  Notification,
  DriverServiceType,
};
