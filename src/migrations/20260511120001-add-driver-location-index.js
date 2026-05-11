'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Partial index on (last_lat, last_lng) for nearby-driver SQL fallback query.
    // Covers: WHERE is_online = true AND is_approved = true AND last_lat BETWEEN ... AND last_lng BETWEEN ...
    // Complements the existing idx_driver_profiles_online_approved partial index
    // which only covers the boolean filter without lat/lng range scan.
    await queryInterface.sequelize.query(`
      CREATE INDEX idx_driver_profiles_nearby
      ON driver_profiles (last_lat, last_lng)
      WHERE is_online = true AND is_approved = true
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS idx_driver_profiles_nearby');
  },
};
