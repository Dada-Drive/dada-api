'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // New ENUM for service categories
    await queryInterface.sequelize.query(
      "CREATE TYPE service_type AS ENUM ('taxi', 'covoiturage', 'cours_partage', 'vespa', 'services')"
    );

    // Add motorcycle to existing vehicle_type ENUM
    await queryInterface.sequelize.query(
      "ALTER TYPE vehicle_type ADD VALUE 'motorcycle'"
    );

    // Add offer_expired to existing notification_type ENUM
    await queryInterface.sequelize.query(
      "ALTER TYPE notification_type ADD VALUE 'offer_expired'"
    );
  },

  async down(queryInterface) {
    // Drop the new service_type ENUM
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS service_type');

    // NOTE: Cannot remove 'motorcycle' from vehicle_type or 'offer_expired'
    // from notification_type — ALTER TYPE ... REMOVE VALUE does not exist in
    // PostgreSQL. These values remain as harmless, unused entries.
  },
};
