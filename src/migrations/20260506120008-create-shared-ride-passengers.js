'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('shared_ride_passengers', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
        allowNull: false,
      },
      primary_ride_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'rides', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      passenger_ride_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'rides', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      rider_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      pickup_lat: {
        type: Sequelize.DECIMAL(10, 8),
        allowNull: false,
      },
      pickup_lng: {
        type: Sequelize.DECIMAL(11, 8),
        allowNull: false,
      },
      pickup_address: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      dropoff_lat: {
        type: Sequelize.DECIMAL(10, 8),
        allowNull: false,
      },
      dropoff_lng: {
        type: Sequelize.DECIMAL(11, 8),
        allowNull: false,
      },
      dropoff_address: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      estimated_fare: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
      },
      final_fare: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
      },
      pickup_order: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      dropoff_order: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      picked_up_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      dropped_off_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      status: {
        type: 'shared_passenger_status',
        allowNull: false,
        defaultValue: 'pending',
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

    // Rider can't join same ride twice
    await queryInterface.addIndex('shared_ride_passengers', ['primary_ride_id', 'rider_id'], {
      unique: true,
      name: 'idx_shared_passengers_ride_rider_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('shared_ride_passengers');
  },
};
