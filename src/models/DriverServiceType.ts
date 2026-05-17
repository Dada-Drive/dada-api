import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize';

import { ServiceType } from '@/types/enums';

class DriverServiceType extends Model<
  InferAttributes<DriverServiceType>,
  InferCreationAttributes<DriverServiceType>
> {
  declare id: CreationOptional<string>;
  declare driverId: string;
  declare serviceType: ServiceType;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

function initDriverServiceType(sequelize: Sequelize): typeof DriverServiceType {
  DriverServiceType.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      driverId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      serviceType: {
        type: DataTypes.ENUM(...Object.values(ServiceType)),
        allowNull: false,
      },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'driver_service_types',
      underscored: true,
    },
  );

  return DriverServiceType;
}

export { DriverServiceType, initDriverServiceType };
