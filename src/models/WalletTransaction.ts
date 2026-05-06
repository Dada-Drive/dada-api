import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize';

import { TransactionStatus, TransactionType } from '@/types/enums';

class WalletTransaction extends Model<
  InferAttributes<WalletTransaction>,
  InferCreationAttributes<WalletTransaction>
> {
  declare id: CreationOptional<string>;
  declare walletOwnerId: string;
  declare type: TransactionType;
  declare amount: number;
  declare status: CreationOptional<TransactionStatus>;
  declare referenceId: string | null;
  declare description: string | null;
  declare createdAt: CreationOptional<Date>;
}

function initWalletTransaction(sequelize: Sequelize): typeof WalletTransaction {
  WalletTransaction.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      walletOwnerId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      type: {
        type: DataTypes.ENUM(...Object.values(TransactionType)),
        allowNull: false,
      },
      amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM(...Object.values(TransactionStatus)),
        allowNull: false,
        defaultValue: TransactionStatus.Completed,
      },
      referenceId: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      createdAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'wallet_transactions',
      underscored: true,
      timestamps: true,
      updatedAt: false,
    },
  );

  return WalletTransaction;
}

export { WalletTransaction, initWalletTransaction };
