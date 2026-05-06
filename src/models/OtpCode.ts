import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize';

class OtpCode extends Model<InferAttributes<OtpCode>, InferCreationAttributes<OtpCode>> {
  declare id: CreationOptional<string>;
  declare phone: string;
  declare codeHash: string;
  declare attempts: CreationOptional<number>;
  declare isUsed: CreationOptional<boolean>;
  declare expiresAt: Date;
  declare createdAt: CreationOptional<Date>;
}

function initOtpCode(sequelize: Sequelize): typeof OtpCode {
  OtpCode.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      phone: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      codeHash: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      attempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      isUsed: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      createdAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'otp_codes',
      underscored: true,
      timestamps: true,
      updatedAt: false,
    },
  );

  return OtpCode;
}

export { OtpCode, initOtpCode };
