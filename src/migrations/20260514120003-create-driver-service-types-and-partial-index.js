'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // ── Create driver_service_types join table ─────────────────────────────
    await queryInterface.createTable('driver_service_types', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
        allowNull: false,
      },
      driver_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      service_type: {
        type: 'service_type',
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

    await queryInterface.addIndex('driver_service_types', ['driver_id', 'service_type'], {
      unique: true,
      name: 'idx_driver_service_types_driver_service_unique',
    });

    // ── Swap ride_offers unique index to partial unique ────────────────────
    // Drop the old full unique (one offer per driver per ride, regardless of status)
    await queryInterface.removeIndex('ride_offers', 'idx_ride_offers_ride_driver_unique');

    // Add partial unique: at most one PENDING offer per driver per ride
    // (allows re-offers after expiration/rejection + cooldown)
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX idx_ride_offers_ride_driver_pending
      ON ride_offers (ride_id, driver_id)
      WHERE status = 'pending'
    `);
  },

  async down(queryInterface) {
    // Restore old full unique index
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS idx_ride_offers_ride_driver_pending'
    );
    await queryInterface.addIndex('ride_offers', ['ride_id', 'driver_id'], {
      unique: true,
      name: 'idx_ride_offers_ride_driver_unique',
    });

    // Drop join table
    await queryInterface.dropTable('driver_service_types');
  },
};
