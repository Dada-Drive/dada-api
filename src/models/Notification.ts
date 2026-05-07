import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize';

import { NotificationType } from '@/types/enums';

class Notification extends Model<
  InferAttributes<Notification>,
  InferCreationAttributes<Notification>
> {
  declare id: CreationOptional<string>;
  declare userId: string;
  declare type: NotificationType;
  declare title: string;
  declare body: string;
  declare data: Record<string, string> | null;
  declare isRead: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
}

function initNotification(sequelize: Sequelize): typeof Notification {
  Notification.init(
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
      type: {
        type: DataTypes.ENUM(...Object.values(NotificationType)),
        allowNull: false,
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      body: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      data: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      isRead: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      createdAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'notifications',
      underscored: true,
      timestamps: true,
      updatedAt: false,
    },
  );

  return Notification;
}

export { Notification, initNotification };
