'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('vehicles', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
        allowNull: false,
      },
      driver_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'driver_profiles', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      make: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      model: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      year: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      plate_number: {
        type: Sequelize.STRING(20),
        allowNull: false,
        unique: true,
      },
      color: {
        type: Sequelize.STRING(30),
        allowNull: false,
      },
      vehicle_type: {
        type: 'vehicle_type',
        allowNull: false,
        defaultValue: 'economy',
      },
      doors: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      seats: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      photo_front: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      photo_side: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      photo_back: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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
    await queryInterface.dropTable('vehicles');
  },
};
