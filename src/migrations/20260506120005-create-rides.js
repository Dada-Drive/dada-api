'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('rides', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
        allowNull: false,
      },
      rider_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      driver_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      passenger_name: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      passenger_phone: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      vehicle_type: {
        type: 'vehicle_type',
        allowNull: false,
      },
      status: {
        type: 'ride_status',
        allowNull: false,
        defaultValue: 'pending',
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
      distance_km: {
        type: Sequelize.DECIMAL(8, 2),
        allowNull: false,
      },
      estimated_minutes: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      calculated_fare: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },
      final_fare: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
      },
      is_shared: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      shared_seats_available: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      commission_rate: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 10.0,
      },
      commission_amount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
      },
      scheduled_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      started_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      arrived_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      approached_notified: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      cancelled_by: {
        type: Sequelize.STRING(10),
        allowNull: true,
      },
      cancel_reason: {
        type: Sequelize.TEXT,
        allowNull: true,
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
  },

  async down(queryInterface) {
    await queryInterface.dropTable('rides');
  },
};
