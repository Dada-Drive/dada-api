import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize';

import { WalletStatus } from '@/types/enums';

class Wallet extends Model<InferAttributes<Wallet>, InferCreationAttributes<Wallet>> {
  declare id: CreationOptional<string>;
  declare ownerId: string;
  declare balance: CreationOptional<number>;
  declare currency: CreationOptional<string>;
  declare status: CreationOptional<WalletStatus>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

function initWallet(sequelize: Sequelize): typeof Wallet {
  Wallet.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      ownerId: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
      },
      balance: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 10.0,
      },
      currency: {
        type: DataTypes.STRING(5),
        allowNull: false,
        defaultValue: 'TND',
      },
      status: {
        type: DataTypes.ENUM(...Object.values(WalletStatus)),
        allowNull: false,
        defaultValue: WalletStatus.Active,
      },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'wallets',
      underscored: true,
    },
  );

  return Wallet;
}

export { Wallet, initWallet };
