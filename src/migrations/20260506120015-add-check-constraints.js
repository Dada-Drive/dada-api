'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Wallet balance must never go negative
    await queryInterface.sequelize.query(`
      ALTER TABLE wallets
      ADD CONSTRAINT chk_wallets_balance_non_negative
      CHECK (balance >= 0)
    `);

    // Transaction amount must always be positive (direction encoded by type)
    await queryInterface.sequelize.query(`
      ALTER TABLE wallet_transactions
      ADD CONSTRAINT chk_wallet_transactions_amount_positive
      CHECK (amount > 0)
    `);

    // Rating score must be 1-5
    await queryInterface.sequelize.query(`
      ALTER TABLE ratings
      ADD CONSTRAINT chk_ratings_score_range
      CHECK (score >= 1 AND score <= 5)
    `);

    // Commission rate must be 0-100
    await queryInterface.sequelize.query(`
      ALTER TABLE rides
      ADD CONSTRAINT chk_rides_commission_rate_range
      CHECK (commission_rate >= 0 AND commission_rate <= 100)
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE rides DROP CONSTRAINT IF EXISTS chk_rides_commission_rate_range
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE ratings DROP CONSTRAINT IF EXISTS chk_ratings_score_range
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS chk_wallet_transactions_amount_positive
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE wallets DROP CONSTRAINT IF EXISTS chk_wallets_balance_non_negative
    `);
  },
};
