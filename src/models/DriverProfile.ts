import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize';

import type { User } from './User';
import type { Vehicle } from './Vehicle';

class DriverProfile extends Model<
  InferAttributes<DriverProfile>,
  InferCreationAttributes<DriverProfile>
> {
  declare id: CreationOptional<string>;
  declare userId: string;
  declare licenseNumber: string;
  declare licenseExpiry: string;
  declare cin: string;
  declare cinDeliveredAt: string;
  declare cinPhotoFront: string | null;
  declare cinPhotoBack: string | null;
  declare licensePhotoFront: string | null;
  declare licensePhotoBack: string | null;
  declare isApproved: CreationOptional<boolean>;
  declare isOnline: CreationOptional<boolean>;
  declare rating: number | null;
  declare totalRides: CreationOptional<number>;
  declare lastLat: number | null;
  declare lastLng: number | null;
  declare lastSeenAt: Date | null;
  declare deletedAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare user?: User;
  declare vehicle?: Vehicle;
}

function initDriverProfile(sequelize: Sequelize): typeof DriverProfile {
  DriverProfile.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
      },
      licenseNumber: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      licenseExpiry: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      cin: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      cinDeliveredAt: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      cinPhotoFront: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      cinPhotoBack: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      licensePhotoFront: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      licensePhotoBack: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      isApproved: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      isOnline: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      rating: {
        type: DataTypes.DECIMAL(3, 2),
        allowNull: true,
      },
      totalRides: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      lastLat: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: true,
      },
      lastLng: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: true,
      },
      lastSeenAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      deletedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'driver_profiles',
      underscored: true,
      paranoid: true,
    },
  );

  return DriverProfile;
}

export { DriverProfile, initDriverProfile };
