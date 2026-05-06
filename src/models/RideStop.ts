import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize';

class RideStop extends Model<InferAttributes<RideStop>, InferCreationAttributes<RideStop>> {
  declare id: CreationOptional<string>;
  declare rideId: string;
  declare address: string;
  declare lat: number;
  declare lng: number;
  declare orderIndex: number;
  declare arrivedAt: Date | null;
  declare leftAt: Date | null;
  declare waitMinutes: number | null;
  declare createdAt: CreationOptional<Date>;
}

function initRideStop(sequelize: Sequelize): typeof RideStop {
  RideStop.init(
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
      address: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      lat: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: false,
      },
      lng: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: false,
      },
      orderIndex: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      arrivedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      leftAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      waitMinutes: {
        type: DataTypes.DECIMAL(8, 2),
        allowNull: true,
      },
      createdAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'ride_stops',
      underscored: true,
      timestamps: true,
      updatedAt: false,
    },
  );

  return RideStop;
}

export { RideStop, initRideStop };
