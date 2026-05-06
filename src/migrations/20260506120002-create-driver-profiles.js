'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('driver_profiles', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      license_number: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      license_expiry: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      cin: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      cin_delivered_at: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      cin_photo_front: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      cin_photo_back: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      license_photo_front: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      license_photo_back: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      is_approved: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      is_online: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      rating: {
        type: Sequelize.DECIMAL(3, 2),
        allowNull: true,
      },
      total_rides: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      last_lat: {
        type: Sequelize.DECIMAL(10, 8),
        allowNull: true,
      },
      last_lng: {
        type: Sequelize.DECIMAL(11, 8),
        allowNull: true,
      },
      last_seen_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      deleted_at: {
        type: Sequelize.DATE,
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
    await queryInterface.dropTable('driver_profiles');
  },
};
