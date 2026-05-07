'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      CREATE TYPE notification_type AS ENUM (
        'new_ride_request', 'ride_offer', 'ride_accepted', 'ride_offer_rejected',
        'driver_arrived', 'ride_started', 'ride_completed', 'ride_cancelled',
        'ride_expired', 'wallet_topup_confirmed', 'wallet_low_balance'
      )
    `);

    await queryInterface.createTable('notifications', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      type: {
        type: 'notification_type',
        allowNull: false,
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      body: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      data: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      is_read: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    await queryInterface.addIndex('notifications', ['user_id', 'is_read', 'created_at'], {
      name: 'idx_notifications_user_unread_created',
    });

    await queryInterface.addIndex('notifications', ['user_id', 'created_at'], {
      name: 'idx_notifications_user_created',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('notifications');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS notification_type');
  },
};
