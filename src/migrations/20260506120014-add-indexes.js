'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // ── Rides ──────────────────────────────────────────────────────────────
    await queryInterface.addIndex('rides', ['status', 'expires_at'], {
      name: 'idx_rides_status_expires_at',
    });
    await queryInterface.addIndex('rides', ['rider_id', 'status'], {
      name: 'idx_rides_rider_status',
    });
    await queryInterface.addIndex('rides', ['driver_id', 'status'], {
      name: 'idx_rides_driver_status',
    });

    // Shared ride matching — partial index on shared rides only
    await queryInterface.sequelize.query(`
      CREATE INDEX idx_rides_shared_status
      ON rides (status)
      WHERE is_shared = true
    `);

    // Scheduled ride activation job
    await queryInterface.sequelize.query(`
      CREATE INDEX idx_rides_scheduled
      ON rides (scheduled_at)
      WHERE status = 'pending' AND scheduled_at IS NOT NULL
    `);

    // ── Ride Offers ───────────────────────────────────────────────────────
    await queryInterface.addIndex('ride_offers', ['ride_id', 'status'], {
      name: 'idx_ride_offers_ride_status',
    });
    await queryInterface.addIndex('ride_offers', ['driver_id', 'status'], {
      name: 'idx_ride_offers_driver_status',
    });

    // ── Wallet Transactions ───────────────────────────────────────────────
    // Partial unique on reference_id for idempotent payment confirmation
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX idx_wallet_txn_reference
      ON wallet_transactions (reference_id)
      WHERE reference_id IS NOT NULL
    `);
    await queryInterface.addIndex('wallet_transactions', ['wallet_owner_id', 'created_at'], {
      name: 'idx_wallet_txn_owner_created',
    });

    // ── Driver Profiles ───────────────────────────────────────────────────
    // Partial index for nearby-driver query — only online+approved drivers
    await queryInterface.sequelize.query(`
      CREATE INDEX idx_driver_profiles_online_approved
      ON driver_profiles (is_online, is_approved)
      WHERE is_online = true AND is_approved = true
    `);

    // ── OTP Codes ─────────────────────────────────────────────────────────
    await queryInterface.addIndex('otp_codes', ['phone', 'is_used', 'expires_at'], {
      name: 'idx_otp_codes_phone_used_expires',
    });

    // ── Refresh Tokens ────────────────────────────────────────────────────
    await queryInterface.addIndex('refresh_tokens', ['user_id'], {
      name: 'idx_refresh_tokens_user',
    });
    // token column already has UNIQUE constraint from table creation

    // ── Device Tokens ─────────────────────────────────────────────────────
    await queryInterface.addIndex('device_tokens', ['user_id'], {
      name: 'idx_device_tokens_user',
    });

    // ── Ratings ───────────────────────────────────────────────────────────
    await queryInterface.addIndex('ratings', ['driver_id', 'created_at'], {
      name: 'idx_ratings_driver_created',
    });

  },

  async down(queryInterface) {
    // Remove in reverse order
    await queryInterface.removeIndex('ratings', 'idx_ratings_driver_created');
    await queryInterface.removeIndex('device_tokens', 'idx_device_tokens_user');
    await queryInterface.removeIndex('refresh_tokens', 'idx_refresh_tokens_user');
    await queryInterface.removeIndex('otp_codes', 'idx_otp_codes_phone_used_expires');
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS idx_driver_profiles_online_approved');
    await queryInterface.removeIndex('wallet_transactions', 'idx_wallet_txn_owner_created');
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS idx_wallet_txn_reference');
    await queryInterface.removeIndex('ride_offers', 'idx_ride_offers_driver_status');
    await queryInterface.removeIndex('ride_offers', 'idx_ride_offers_ride_status');
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS idx_rides_scheduled');
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS idx_rides_shared_status');
    await queryInterface.removeIndex('rides', 'idx_rides_driver_status');
    await queryInterface.removeIndex('rides', 'idx_rides_rider_status');
    await queryInterface.removeIndex('rides', 'idx_rides_status_expires_at');
  },
};
