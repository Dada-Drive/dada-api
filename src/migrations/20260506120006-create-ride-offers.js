'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ride_offers', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
        allowNull: false,
      },
      ride_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'rides', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      driver_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      status: {
        type: 'offer_status',
        allowNull: false,
        defaultValue: 'pending',
      },
      offered_fare: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    // One offer per driver per ride
    await queryInterface.addIndex('ride_offers', ['ride_id', 'driver_id'], {
      unique: true,
      name: 'idx_ride_offers_ride_driver_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ride_offers');
  },
};
