'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add service_type to rides (NOT NULL with DEFAULT — metadata-only in PG 11+)
    await queryInterface.addColumn('rides', 'service_type', {
      type: 'service_type',
      allowNull: false,
      defaultValue: 'taxi',
    });

    // Add hide_estimate to rides (NOT NULL with DEFAULT — metadata-only in PG 11+)
    await queryInterface.addColumn('rides', 'hide_estimate', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    // Add expires_at to ride_offers (nullable — no backfill needed)
    await queryInterface.addColumn('ride_offers', 'expires_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('ride_offers', 'expires_at');
    await queryInterface.removeColumn('rides', 'hide_estimate');
    await queryInterface.removeColumn('rides', 'service_type');
  },
};
