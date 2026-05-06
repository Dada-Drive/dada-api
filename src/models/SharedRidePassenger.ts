import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize';

import { SharedPassengerStatus } from '@/types/enums';

class SharedRidePassenger extends Model<
  InferAttributes<SharedRidePassenger>,
  InferCreationAttributes<SharedRidePassenger>
> {
  declare id: CreationOptional<string>;
  declare primaryRideId: string;
  declare passengerRideId: string | null;
  declare riderId: string;
  declare pickupLat: number;
  declare pickupLng: number;
  declare pickupAddress: string;
  declare dropoffLat: number;
  declare dropoffLng: number;
  declare dropoffAddress: string;
  declare estimatedFare: number | null;
  declare finalFare: number | null;
  declare pickupOrder: number | null;
  declare dropoffOrder: number | null;
  declare pickedUpAt: Date | null;
  declare droppedOffAt: Date | null;
  declare status: CreationOptional<SharedPassengerStatus>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

function initSharedRidePassenger(sequelize: Sequelize): typeof SharedRidePassenger {
  SharedRidePassenger.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      primaryRideId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      passengerRideId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      riderId: {
        type: DataTypes.UUID,
        allowNull: false,
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
      estimatedFare: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
      },
      finalFare: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
      },
      pickupOrder: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      dropoffOrder: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      pickedUpAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      droppedOffAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM(...Object.values(SharedPassengerStatus)),
        allowNull: false,
        defaultValue: SharedPassengerStatus.Pending,
      },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'shared_ride_passengers',
      underscored: true,
    },
  );

  return SharedRidePassenger;
}

export { SharedRidePassenger, initSharedRidePassenger };
