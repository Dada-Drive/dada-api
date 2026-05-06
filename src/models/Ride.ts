import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize';

import { RideStatus, VehicleType } from '@/types/enums';

class Ride extends Model<InferAttributes<Ride>, InferCreationAttributes<Ride>> {
  declare id: CreationOptional<string>;
  declare riderId: string;
  declare driverId: string | null;
  declare passengerName: string | null;
  declare passengerPhone: string | null;
  declare vehicleType: VehicleType;
  declare status: CreationOptional<RideStatus>;
  declare pickupLat: number;
  declare pickupLng: number;
  declare pickupAddress: string;
  declare dropoffLat: number;
  declare dropoffLng: number;
  declare dropoffAddress: string;
  declare distanceKm: number;
  declare estimatedMinutes: number;
  declare calculatedFare: number;
  declare finalFare: number | null;
  declare isShared: CreationOptional<boolean>;
  declare sharedSeatsAvailable: number | null;
  declare commissionRate: CreationOptional<number>;
  declare commissionAmount: number | null;
  declare scheduledAt: Date | null;
  declare expiresAt: Date | null;
  declare startedAt: Date | null;
  declare arrivedAt: Date | null;
  declare approachedNotified: CreationOptional<boolean>;
  declare completedAt: Date | null;
  declare cancelledBy: string | null;
  declare cancelReason: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

function initRide(sequelize: Sequelize): typeof Ride {
  Ride.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      riderId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      driverId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      passengerName: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      passengerPhone: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      vehicleType: {
        type: DataTypes.ENUM(...Object.values(VehicleType)),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM(...Object.values(RideStatus)),
        allowNull: false,
        defaultValue: RideStatus.Pending,
      },
      pickupLat: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: false,
      },
      pickupLng: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: false,
      },
      pickupAddress: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      dropoffLat: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: false,
      },
      dropoffLng: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: false,
      },
      dropoffAddress: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      distanceKm: {
        type: DataTypes.DECIMAL(8, 2),
        allowNull: false,
      },
      estimatedMinutes: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      calculatedFare: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
      },
      finalFare: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
      },
      isShared: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      sharedSeatsAvailable: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      commissionRate: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 10.0,
      },
      commissionAmount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
      },
      scheduledAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      startedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      arrivedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      approachedNotified: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      completedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      cancelledBy: {
        type: DataTypes.STRING(10),
        allowNull: true,
      },
      cancelReason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'rides',
      underscored: true,
    },
  );

  return Ride;
}

export { Ride, initRide };
