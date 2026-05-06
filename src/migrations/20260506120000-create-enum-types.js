'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      "CREATE TYPE user_role AS ENUM ('rider', 'driver', 'admin', 'pending')"
    );
    await queryInterface.sequelize.query(
      "CREATE TYPE ride_status AS ENUM ('pending', 'offered', 'accepted', 'in_progress', 'completed', 'cancelled')"
    );
    await queryInterface.sequelize.query(
      "CREATE TYPE offer_status AS ENUM ('pending', 'accepted', 'rejected', 'expired')"
    );
    await queryInterface.sequelize.query(
      "CREATE TYPE vehicle_type AS ENUM ('economy', 'premium', 'van')"
    );
    await queryInterface.sequelize.query(
      "CREATE TYPE wallet_status AS ENUM ('active', 'suspended', 'closed')"
    );
    await queryInterface.sequelize.query(
      "CREATE TYPE transaction_type AS ENUM ('topup_manual', 'topup_online', 'commission', 'ride_earning', 'withdrawal')"
    );
    await queryInterface.sequelize.query(
      "CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'failed', 'refunded')"
    );
    await queryInterface.sequelize.query(
      "CREATE TYPE device_platform AS ENUM ('ios', 'android')"
    );
    await queryInterface.sequelize.query(
      "CREATE TYPE shared_passenger_status AS ENUM ('pending', 'confirmed', 'picked_up', 'dropped_off', 'cancelled')"
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS shared_passenger_status');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS device_platform');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS transaction_status');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS transaction_type');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS wallet_status');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS vehicle_type');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS offer_status');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS ride_status');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS user_role');
  },
};
