import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize';

import { DevicePlatform } from '@/types/enums';

class DeviceToken extends Model<
  InferAttributes<DeviceToken>,
  InferCreationAttributes<DeviceToken>
> {
  declare id: CreationOptional<string>;
  declare userId: string;
  declare token: string;
  declare platform: DevicePlatform;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

function initDeviceToken(sequelize: Sequelize): typeof DeviceToken {
  DeviceToken.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      token: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      platform: {
        type: DataTypes.ENUM(...Object.values(DevicePlatform)),
        allowNull: false,
      },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'device_tokens',
      underscored: true,
    },
  );

  return DeviceToken;
}

export { DeviceToken, initDeviceToken };
