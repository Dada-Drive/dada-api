import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize';

import { OfferStatus } from '@/types/enums';

class RideOffer extends Model<InferAttributes<RideOffer>, InferCreationAttributes<RideOffer>> {
  declare id: CreationOptional<string>;
  declare rideId: string;
  declare driverId: string;
  declare status: CreationOptional<OfferStatus>;
  declare offeredFare: number;
  declare expiresAt: Date | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

function initRideOffer(sequelize: Sequelize): typeof RideOffer {
  RideOffer.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      rideId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      driverId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM(...Object.values(OfferStatus)),
        allowNull: false,
        defaultValue: OfferStatus.Pending,
      },
      offeredFare: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'ride_offers',
      underscored: true,
    },
  );

  return RideOffer;
}

export { RideOffer, initRideOffer };
