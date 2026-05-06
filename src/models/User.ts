import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize';

import { UserRole } from '@/types/enums';

class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare id: CreationOptional<string>;
  declare fullName: string;
  declare email: string | null;
  declare phone: string;
  declare passwordHash: string | null;
  declare role: CreationOptional<UserRole>;
  declare avatarUrl: string | null;
  declare googleId: string | null;
  declare isVerified: CreationOptional<boolean>;
  declare isActive: CreationOptional<boolean>;
  declare deletedAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

function initUser(sequelize: Sequelize): typeof User {
  User.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      fullName: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING(150),
        allowNull: true,
      },
      phone: {
        type: DataTypes.STRING(20),
        allowNull: false,
        unique: true,
      },
      passwordHash: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      role: {
        type: DataTypes.ENUM(...Object.values(UserRole)),
        allowNull: false,
        defaultValue: UserRole.Rider,
      },
      avatarUrl: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      googleId: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      isVerified: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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
      tableName: 'users',
      underscored: true,
      paranoid: true,
      defaultScope: {
        attributes: { exclude: ['passwordHash', 'deletedAt'] },
      },
      scopes: {
        withPassword: {
          attributes: { exclude: ['deletedAt'] },
        },
      },
    },
  );

  return User;
}

export { User, initUser };
