import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize';

import { VehicleType } from '@/types/enums';

class Vehicle extends Model<InferAttributes<Vehicle>, InferCreationAttributes<Vehicle>> {
  declare id: CreationOptional<string>;
  declare driverId: string;
  declare make: string;
  declare model: string;
  declare year: number | null;
  declare plateNumber: string;
  declare color: string;
  declare vehicleType: CreationOptional<VehicleType>;
  declare doors: number | null;
  declare seats: number | null;
  declare photoFront: string | null;
  declare photoSide: string | null;
  declare photoBack: string | null;
  declare isActive: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

function initVehicle(sequelize: Sequelize): typeof Vehicle {
  Vehicle.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      driverId: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
      },
      make: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      model: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      year: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      plateNumber: {
        type: DataTypes.STRING(20),
        allowNull: false,
        unique: true,
      },
      color: {
        type: DataTypes.STRING(30),
        allowNull: false,
      },
      vehicleType: {
        type: DataTypes.ENUM(...Object.values(VehicleType)),
        allowNull: false,
        defaultValue: VehicleType.Economy,
      },
      doors: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      seats: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      photoFront: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      photoSide: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      photoBack: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'vehicles',
      underscored: true,
    },
  );

  return Vehicle;
}

export { Vehicle, initVehicle };
