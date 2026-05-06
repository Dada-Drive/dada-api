'use strict';

const USERS = {
  admin:   '00000000-0000-4000-a000-000000000001',
  rider1:  '00000000-0000-4000-a000-000000000002',
  rider2:  '00000000-0000-4000-a000-000000000003',
  rider3:  '00000000-0000-4000-a000-000000000004',
  rider4:  '00000000-0000-4000-a000-000000000005',
  rider5:  '00000000-0000-4000-a000-000000000006',
  driver1: '00000000-0000-4000-a000-000000000007',
  driver2: '00000000-0000-4000-a000-000000000008',
  driver3: '00000000-0000-4000-a000-000000000009',
  pending: '00000000-0000-4000-a000-000000000010',
};

const WALLETS = {
  admin:   '00000000-0000-4000-d000-000000000001',
  rider1:  '00000000-0000-4000-d000-000000000002',
  rider2:  '00000000-0000-4000-d000-000000000003',
  rider3:  '00000000-0000-4000-d000-000000000004',
  rider4:  '00000000-0000-4000-d000-000000000005',
  rider5:  '00000000-0000-4000-d000-000000000006',
  driver1: '00000000-0000-4000-d000-000000000007',
  driver2: '00000000-0000-4000-d000-000000000008',
  driver3: '00000000-0000-4000-d000-000000000009',
  pending: '00000000-0000-4000-d000-000000000010',
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();

    const wallets = Object.entries(USERS).map(([key, userId]) => {
      let balance = 100.0; // riders
      if (key.startsWith('driver')) balance = 50.0;
      if (key === 'admin' || key === 'pending') balance = 0.0;

      return {
        id: WALLETS[key],
        owner_id: userId,
        balance,
        currency: 'TND',
        status: 'active',
        created_at: now,
        updated_at: now,
      };
    });

    await queryInterface.bulkInsert('wallets', wallets);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('wallets', null, {});
  },
};
