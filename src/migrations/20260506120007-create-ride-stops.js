'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ride_stops', {
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
      address: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      lat: {
        type: Sequelize.DECIMAL(10, 8),
        allowNull: false,
      },
      lng: {
        type: Sequelize.DECIMAL(11, 8),
        allowNull: false,
      },
      order_index: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      arrived_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      left_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      wait_minutes: {
        type: Sequelize.DECIMAL(8, 2),
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    // No duplicate ordering per ride
    await queryInterface.addIndex('ride_stops', ['ride_id', 'order_index'], {
      unique: true,
      name: 'idx_ride_stops_ride_order_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ride_stops');
  },
};
