import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize';

class Rating extends Model<InferAttributes<Rating>, InferCreationAttributes<Rating>> {
  declare id: CreationOptional<string>;
  declare rideId: string;
  declare riderId: string;
  declare driverId: string;
  declare score: number;
  declare comment: string | null;
  declare createdAt: CreationOptional<Date>;
}

function initRating(sequelize: Sequelize): typeof Rating {
  Rating.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      rideId: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
      },
      riderId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      driverId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      score: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      comment: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      createdAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'ratings',
      underscored: true,
      timestamps: true,
      updatedAt: false,
    },
  );

  return Rating;
}

export { Rating, initRating };
